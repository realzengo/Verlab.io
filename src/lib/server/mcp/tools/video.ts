import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVideoGenerationCost } from "@/lib/config/pricing";
import { DEFAULT_VIDEO_MODEL, VIDEO_MODELS, getVideoModel, type VideoModelConfig } from "@/lib/config/video-models";
import { submitVideoJob } from "@/lib/server/replicate-video";
import { buildReplicateCreateInput } from "@/lib/server/video-create-input";
import { advanceVideoJob, VIDEO_JOB_COLUMNS, type VideoJobRow } from "@/lib/server/video-jobs";
import { describeGenerationFailure } from "@/lib/server/generation-error";
import { recordUsageEvent } from "@/lib/server/usage";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { isAdminEmail } from "@/lib/server/admin";
import { FREE_TEXT_MAX, isSafeFreeText } from "@/lib/validation";
import { ImageInputError, resolveImageInput, resolveImageInputs } from "../image-input";
import { APP_LINKS, MCP_PUBLIC_ORIGIN, signMediaUrl } from "../links";
import {
  appResult,
  CREATES,
  errorResult,
  requireCredits,
  STATUS_CHECK,
  UUID_PATTERN,
  type McpToolDefinition,
  type McpToolResult,
} from "./shared";

// Video renders take minutes, so generate_video only submits the Replicate
// prediction and returns; the video card polls check_video_status, which
// advances the row itself (same advanceVideoJob the webhook and cron use --
// idempotent, charges exactly once on completion). That means completion
// never depends on the webhook reaching us, and nothing is charged for a
// render that fails.

// Same windows as /api/generate-video's stale sweep.
const STALE_JOB_MS = 20 * 60 * 1000;
const CLONE_STALE_JOB_MS = 40 * 60 * 1000;

const WEBHOOK_URL = MCP_PUBLIC_ORIGIN.startsWith("https://") ? `${MCP_PUBLIC_ORIGIN}/api/webhooks/replicate` : undefined;

function modelCatalogLine(model: VideoModelConfig): string {
  const shortest = model.durations[0];
  const longest = model.durations[model.durations.length - 1];
  const credits = (seconds: number) => getVideoGenerationCost({ model: model.id, durationSeconds: seconds, outputs: 1, resolution: model.resolutions?.[0] });
  const plan = model.requiresScale ? ", Scale plan" : model.requiresPro ? ", Pro plan" : "";
  const extras = [model.supportsAudio ? "native audio" : null, model.supportsEndFrame ? "end frame" : null].filter(Boolean).join(", ");
  const cost = shortest === longest ? `${credits(shortest)} credits` : `${credits(shortest)}-${credits(longest)} credits`;
  return `${model.id} (${model.durations.join("/")}s, ${model.aspectRatios.join(" ")}${extras ? `, ${extras}` : ""}${plan}; ~${cost}): ${model.description}`;
}

const MODEL_IDS = VIDEO_MODELS.map((model) => model.id) as [string, ...string[]];

async function planProblem(userId: string, model: VideoModelConfig): Promise<McpToolResult | null> {
  if (!model.requiresPro && !model.requiresScale) return null;
  const admin = createAdminClient();
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin.from("profiles").select("plan").eq("id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);
  if (isAdminEmail(authUser?.user?.email)) return null;
  const plan = profile?.plan as string | undefined;
  const allowed = model.requiresScale ? plan === "scale" : plan === "pro" || plan === "scale";
  if (allowed) return null;
  const needed = model.requiresScale ? "Scale" : "Pro";
  return errorResult(
    `${model.id} needs the ${needed} plan. Pick another model (for example ${DEFAULT_VIDEO_MODEL}) or upgrade at ${APP_LINKS.pricing}.`,
    "plan_required",
    { actionUrl: APP_LINKS.pricing, plan: needed }
  );
}

interface VideoRow extends VideoJobRow {
  prompt: string | null;
  output_video_path: string | null;
  error_message: string | null;
  created_at: string;
}

function videoPayload(row: VideoRow) {
  const params = (row.params ?? {}) as { durationSeconds?: number; aspectRatio?: string; resolution?: string };
  const base = {
    id: row.id,
    model: row.model,
    prompt: row.prompt ?? "",
    durationSeconds: typeof params.durationSeconds === "number" ? Math.round(params.durationSeconds * 10) / 10 : null,
    aspectRatio: params.aspectRatio ?? null,
    resolution: params.resolution ?? null,
    cost: row.credits_quoted,
    createdAt: row.created_at,
    appUrl: APP_LINKS.videoGenerator,
  };
  if (row.status === "completed" && row.output_video_path) {
    return { ...base, status: "completed", url: signMediaUrl("video", row.id), downloadUrl: signMediaUrl("video", row.id, 0, { download: true }) };
  }
  return { ...base, status: row.status === "failed" ? "failed" : row.status === "processing" ? "processing" : "queued" };
}

function videoText(payload: ReturnType<typeof videoPayload>): string {
  if (payload.status === "completed" && "url" in payload) {
    return `The video is ready (${payload.model}${payload.durationSeconds ? `, ${payload.durationSeconds}s` : ""}${payload.aspectRatio ? `, ${payload.aspectRatio}` : ""}), playing in the card above. Download: ${payload.downloadUrl}`;
  }
  return `Rendering on ${payload.model} -- usually 1-4 minutes. The card above shows progress and plays the video when it's done; don't call check_video_status again unless the user asks.`;
}

const generateVideoTool: McpToolDefinition = {
  name: "generate_video",
  title: "Generate an AI video",
  description:
    "Generates an AI video clip from a text prompt, or animates an image (image-to-video) -- B-roll, hooks, scenes, product shots. Defaults to vertical 9:16. " +
    "startImage can be a Verlab image ref from generate_image (image:<id>:<n>) or a public https image URL. Rendering takes 1-4 minutes; the card plays " +
    "the result when it's done. Charges credits only when the render succeeds.\nModels:\n" +
    VIDEO_MODELS.map((model) => `- ${modelCatalogLine(model)}`).join("\n"),
  inputSchema: {
    prompt: z.string().optional().describe("What happens in the shot: subject, action, camera movement, style, lighting. Required unless startImage is given."),
    model: z.enum(MODEL_IDS).optional().describe(`Defaults to ${DEFAULT_VIDEO_MODEL}.`),
    durationSeconds: z.number().int().optional().describe("Must be one of the model's durations (listed above). Defaults to its shortest."),
    aspectRatio: z.string().optional().describe("Defaults to 9:16 when the model supports it."),
    resolution: z.string().optional().describe("720p, 1080p or 480p where the model offers it. Defaults to the model's first option."),
    sound: z.boolean().optional().describe("Native audio on models that support it. Defaults to on."),
    startImage: z.string().optional().describe("Image to animate / use as the first frame: image:<id>:<n> or an https image URL."),
    endImage: z.string().optional().describe("Optional last frame, on models that support it."),
    referenceImages: z.array(z.string()).max(4).optional().describe("Optional style/subject reference images (refs or https URLs)."),
  },
  annotations: CREATES,
  handler: async (userId, args) => {
    const model = getVideoModel(typeof args.model === "string" ? args.model : DEFAULT_VIDEO_MODEL);
    if (!model) return errorResult(`Unknown model. Pick one of: ${MODEL_IDS.join(", ")}.`, "invalid_input");

    const blocked = await planProblem(userId, model);
    if (blocked) return blocked;

    const durationSeconds = args.durationSeconds === undefined ? model.durations[0] : Number(args.durationSeconds);
    if (!model.durations.includes(durationSeconds)) {
      return errorResult(`${model.id} makes ${model.durations.join(", ")} second videos.`, "invalid_input");
    }
    const aspectRatio =
      typeof args.aspectRatio === "string" && args.aspectRatio
        ? args.aspectRatio
        : model.aspectRatios.includes("9:16")
          ? "9:16"
          : model.aspectRatios[0];
    if (!model.aspectRatios.includes(aspectRatio)) {
      return errorResult(`${model.id} supports ${model.aspectRatios.join(", ")} aspect ratios.`, "invalid_input");
    }
    const resolution = model.resolutions ? (typeof args.resolution === "string" && args.resolution ? args.resolution : model.resolutions[0]) : undefined;
    if (model.resolutions && (!resolution || !model.resolutions.includes(resolution))) {
      return errorResult(`${model.id} renders at ${model.resolutions.join(", ")}.`, "invalid_input");
    }
    const soundEnabled = model.supportsAudio ? args.sound !== false : false;

    const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
    const maxPrompt = model.maxPromptLength ?? FREE_TEXT_MAX;
    if (prompt && prompt.length > maxPrompt) {
      return errorResult(`${model.id}'s prompt must be ${maxPrompt} characters or fewer (this one is ${prompt.length}).`, "invalid_input");
    }
    if (prompt && !isSafeFreeText(prompt, maxPrompt)) return errorResult("The prompt contains characters that aren't allowed.", "invalid_input");

    const rawStart = typeof args.startImage === "string" ? args.startImage.trim() : "";
    const rawEnd = typeof args.endImage === "string" ? args.endImage.trim() : "";
    const rawRefs = Array.isArray(args.referenceImages) ? args.referenceImages.map(String).filter(Boolean) : [];
    if (!prompt && !rawStart && !rawEnd) return errorResult("Describe the video, or give a startImage to animate.", "invalid_input");
    if (rawStart && !model.supportsImageToVideo) return errorResult(`${model.id} can't animate images.`, "invalid_input");
    if (rawEnd && !model.supportsEndFrame) return errorResult(`${model.id} doesn't take an end frame.`, "invalid_input");
    if (rawRefs.length && !model.supportsReferenceImages) return errorResult(`${model.id} doesn't take reference images.`, "invalid_input");
    if (rawRefs.length > (model.maxReferenceImages ?? 4)) {
      return errorResult(`${model.id} takes at most ${model.maxReferenceImages ?? 4} reference images.`, "invalid_input");
    }

    let startFrameImage: string | null = null;
    let endFrameImage: string | null = null;
    let referenceImages: string[] = [];
    try {
      [startFrameImage, endFrameImage, referenceImages] = await Promise.all([
        rawStart ? resolveImageInput(userId, rawStart) : Promise.resolve(null),
        rawEnd ? resolveImageInput(userId, rawEnd) : Promise.resolve(null),
        resolveImageInputs(userId, rawRefs),
      ]);
    } catch (error) {
      if (error instanceof ImageInputError) return errorResult(error.message, "invalid_input");
      throw error;
    }

    if (!(await checkRateLimit(`generate-video:${userId}`, 10, 60))) {
      return errorResult("Too many videos started in the last minute. Wait a moment and try again.", "failed");
    }

    const cost = getVideoGenerationCost({ model: model.id, durationSeconds, outputs: 1, resolution });
    const lacking = await requireCredits(userId, cost);
    if (lacking) return lacking;

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("video_generations")
      .insert({
        user_id: userId,
        mode: "create",
        operation: startFrameImage || endFrameImage ? "image_to_video" : "text_to_video",
        model: model.id,
        replicate_model: model.replicateModel,
        prompt: prompt || null,
        params: { durationSeconds, aspectRatio, resolution, soundEnabled, outputs: 1 },
        credits_quoted: cost,
        status: "queued",
      })
      .select(`${VIDEO_JOB_COLUMNS}, prompt, output_video_path, error_message, created_at`)
      .single<VideoRow>();
    if (insertError || !row) return errorResult("Couldn't start the video. Please try again.");

    try {
      const input = buildReplicateCreateInput(model, {
        prompt: prompt || undefined,
        aspectRatio,
        durationSeconds,
        resolution,
        soundEnabled,
        startFrameImage,
        endFrameImage,
        referenceImages,
      });
      const { predictionId } = await submitVideoJob(model.replicateModel, input, WEBHOOK_URL);
      await admin.from("video_generations").update({ replicate_prediction_id: predictionId }).eq("id", row.id);
    } catch (error) {
      const failure = describeGenerationFailure("mcp/generate_video", error);
      await admin.from("video_generations").update({ status: "failed", ...failure }).eq("id", row.id);
      return errorResult(`${failure.error_message} Nothing was charged.`);
    }

    recordUsageEvent("video", userId, { mode: "create", model: model.id, outputs: 1, source: "mcp" });
    const payload = videoPayload(row);
    return appResult(`Started a ${durationSeconds}s ${aspectRatio} video (id ${row.id}). ${videoText(payload)}`, payload);
  },
};

const checkVideoStatusTool: McpToolDefinition = {
  name: "check_video_status",
  title: "Check video status",
  description: "Checks a video render by its id (from generate_video or the Verlab library) and returns the video once it's done. The video card polls this itself.",
  inputSchema: { id: z.string() },
  annotations: STATUS_CHECK,
  handler: async (userId, args) => {
    const id = String(args.id ?? "").trim();
    if (!UUID_PATTERN.test(id)) return errorResult("That isn't a valid video id.", "invalid_input");

    const admin = createAdminClient();
    const select = `${VIDEO_JOB_COLUMNS}, prompt, output_video_path, error_message, created_at`;
    const load = () => admin.from("video_generations").select(select).eq("id", id).eq("user_id", userId).maybeSingle<VideoRow>();

    let { data: row } = await load();
    if (!row) return errorResult("That video wasn't found on this account.", "not_found");

    if (row.status === "queued" || row.status === "processing") {
      const staleMs = row.mode === "motion" ? CLONE_STALE_JOB_MS : STALE_JOB_MS;
      if (Date.now() - new Date(row.created_at).getTime() > staleMs) {
        await admin
          .from("video_generations")
          .update({ status: "failed", error_message: "Generation timed out. Please try again." })
          .eq("id", id)
          .in("status", ["queued", "processing"]);
      } else if (row.replicate_prediction_id) {
        await advanceVideoJob(row, admin, { webhookUrl: WEBHOOK_URL });
      }
      ({ data: row } = await load());
      if (!row) return errorResult("That video wasn't found on this account.", "not_found");
    }

    if (row.status === "failed") return errorResult(`${row.error_message ?? "The render failed."} Nothing was charged.`);
    const payload = videoPayload(row);
    return appResult(videoText(payload), payload);
  },
};

export const VIDEO_TOOLS: McpToolDefinition[] = [generateVideoTool, checkVideoStatusTool];
