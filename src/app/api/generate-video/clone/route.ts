import { NextRequest, NextResponse } from "next/server";
import { getVideoCloneCost } from "@/lib/config/pricing";
import { CLONE_TOOL_MODES, cloneNeedsFrameStage, getCloneMode, type CloneResolution } from "@/lib/config/video-models";
import { getUserCredits } from "@/lib/server/credits";
import { submitVideoJob } from "@/lib/server/replicate-video";
import { buildCloneSubmission, CLONE_INPUT_URL_TTL_SECONDS, type CloneJobParams } from "@/lib/server/video-clone";
import { readMp4DurationSeconds } from "@/lib/server/mp4-duration";
import { validateReferenceImage, validateReferenceImages } from "@/lib/server/video-validation";
import { describeGenerationFailure } from "@/lib/server/generation-error";
import { recordUsageEvent } from "@/lib/server/usage";
import { withApiLogging } from "@/lib/server/api-logging";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { isSafeFreeText } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30; // submits the first prediction and returns -- the webhook/cron finish (and, for Match background, chain) the rest

const STORAGE_BUCKET = "videos";
const ASPECT_RATIO_PATTERN = /^\d{1,2}:\d{1,2}$/;

interface CloneVideoRequestBody {
  /** The CLONE_MODES id of a tool's own model (CLONE_TOOLS) -- there's no model picker, so nothing else is accepted. */
  mode?: string;
  sourceGenerationId?: string;
  referenceImages?: string[];
  prompt?: string;
  resolution?: string;
  /** Display hint for tiles, and Motion transfer's output orientation (snapped to what Kling 4.0 renders). */
  aspectRatio?: string;
  /** Character: keep the clip's soundtrack. */
  keepOriginalSound?: boolean;
  /** Character: put the character into the clip's own scene. */
  matchBackground?: boolean;
  /** The clip's first frame, captured client-side (no server-side ffmpeg) -- required when the model starts with a frame pre-pass. */
  frameImage?: string;
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`generate-video-clone:${user.id}`, 10, 60))) {
    return rateLimitedResponse();
  }

  let body: CloneVideoRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = getCloneMode(body.mode ?? "");
  if (!mode || !CLONE_TOOL_MODES.includes(mode)) {
    return NextResponse.json({ error: "mode must be one of the supported clone modes" }, { status: 400 });
  }
  const isCharacter = mode.tool === "character";

  const resolution = body.resolution as CloneResolution;
  if (!mode.resolutions.includes(resolution)) {
    return NextResponse.json({ error: `resolution must be one of: ${mode.resolutions.join(", ")}` }, { status: 400 });
  }

  const prompt = body.prompt?.trim() || null;
  if (prompt && prompt.length > mode.maxPromptLength) {
    return NextResponse.json({ error: `Keep the prompt under ${mode.maxPromptLength} characters (this one is ${prompt.length}).` }, { status: 400 });
  }
  if (prompt && !isSafeFreeText(prompt, mode.maxPromptLength)) {
    return NextResponse.json({ error: "prompt contains characters that aren't allowed" }, { status: 400 });
  }

  const matchBackground = isCharacter && (mode.matchBackgroundOnly === true || body.matchBackground === true);
  const keepOriginalSound = body.keepOriginalSound !== false;

  let referenceImages: string[];
  const needsFrame = cloneNeedsFrameStage(mode, matchBackground);
  let frameImage: string | null = null;
  try {
    referenceImages = validateReferenceImages(body.referenceImages, "referenceImages", mode.maxReferenceImages);
    if (needsFrame) frameImage = validateReferenceImage(body.frameImage, "frameImage");
  } catch (validationError) {
    return NextResponse.json({ error: (validationError as Error).message }, { status: 400 });
  }

  if (mode.tool === "object_swap" && !prompt) {
    return NextResponse.json({ error: "Say what to change in the video" }, { status: 400 });
  }
  if (mode.tool === "motion_transfer" && !prompt && referenceImages.length === 0) {
    return NextResponse.json({ error: "Add at least one image or describe the new scene" }, { status: 400 });
  }
  if (isCharacter && referenceImages.length !== 1) {
    return NextResponse.json({ error: "Add one clear photo of your character" }, { status: 400 });
  }
  if (needsFrame && !frameImage) {
    return NextResponse.json({ error: "frameImage is required for this tool" }, { status: 400 });
  }

  const aspectRatio = typeof body.aspectRatio === "string" && ASPECT_RATIO_PATTERN.test(body.aspectRatio) ? body.aspectRatio : undefined;

  if (!body.sourceGenerationId || typeof body.sourceGenerationId !== "string") {
    return NextResponse.json({ error: "sourceGenerationId is required" }, { status: 400 });
  }

  const { data: sourceRow } = await supabase
    .from("video_generations")
    .select("status, output_video_path, operation, params")
    .eq("id", body.sourceGenerationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sourceRow) {
    return NextResponse.json({ error: "Source video not found" }, { status: 404 });
  }
  if (sourceRow.status !== "completed" || !sourceRow.output_video_path) {
    return NextResponse.json({ error: "Source video isn't ready yet" }, { status: 400 });
  }
  // Uploads from before in-browser conversion keep whatever quirks their
  // file had (non-square pixels, rotation flags, HEVC...), which providers
  // reject only after a paid job is queued. Generated videos are already
  // provider output, so only raw uploads need the flag.
  const sourceParams = sourceRow.params as { normalized?: boolean; width?: number; height?: number } | null;
  if (sourceRow.operation === "uploaded" && sourceParams?.normalized !== true) {
    return NextResponse.json(
      { error: "Please upload this video again -- it'll be converted to a format every model accepts." },
      { status: 400 }
    );
  }
  // Uploads record their converted size; ones from before the converter
  // scaled small clips up can sit under Kling's per-side minimum, which it
  // only reports after the job is queued.
  if (mode.minSourceSidePx && sourceParams?.width && sourceParams?.height && Math.min(sourceParams.width, sourceParams.height) < mode.minSourceSidePx) {
    return NextResponse.json(
      {
        error: `This video needs to be at least ${mode.minSourceSidePx}px on each side (this one is ${sourceParams.width}x${sourceParams.height}). Upload it again and it'll be scaled up automatically.`,
      },
      { status: 400 }
    );
  }

  // One URL serves both the duration probe below and the provider's own
  // fetch of the clip, hence the provider-length TTL.
  const admin = createAdminClient();
  const { data: signedSource, error: signError } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(sourceRow.output_video_path, CLONE_INPUT_URL_TTL_SECONDS);

  if (signError || !signedSource) {
    console.error("[generate-video/clone] Failed to sign source video URL:", signError);
    return NextResponse.json({ error: "Could not load source video" }, { status: 500 });
  }

  // Priced off the file's own headers, never the browser-reported duration
  // stored at upload -- every engine bills the full source clip, so a forged
  // short duration would otherwise undercharge (see mp4-duration.ts).
  const sourceDurationSeconds = await readMp4DurationSeconds(signedSource.signedUrl);
  if (!sourceDurationSeconds) {
    return NextResponse.json({ error: "We couldn't read this video's length. Upload an MP4 or MOV file." }, { status: 400 });
  }
  if (sourceDurationSeconds < mode.minSourceDurationSeconds || sourceDurationSeconds > mode.maxSourceDurationSeconds) {
    return NextResponse.json(
      {
        error: `The video must be ${mode.minSourceDurationSeconds} to ${mode.maxSourceDurationSeconds} seconds (this one is ${Math.round(sourceDurationSeconds * 10) / 10}s).`,
      },
      { status: 400 }
    );
  }

  const cost = getVideoCloneCost({ mode: mode.id, sourceDurationSeconds, resolution, matchBackground });

  // Checked synchronously, same rationale as /api/generate-video's create
  // path: charging happens only once the final render lands.
  const balance = await getUserCredits(user.id);
  if (balance < cost) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  const params: CloneJobParams = {
    tool: mode.tool,
    cloneStage: needsFrame ? "frame" : "video",
    sourceGenerationId: body.sourceGenerationId,
    durationSeconds: sourceDurationSeconds,
    resolution,
    aspectRatio,
    referenceImageCount: referenceImages.length,
    ...(isCharacter ? { keepOriginalSound, matchBackground } : {}),
  };

  // The frame pre-pass or the render itself, in the chosen model's own shape.
  const submission = buildCloneSubmission(mode, {
    prompt,
    videoUrl: signedSource.signedUrl,
    referenceImages,
    resolution,
    durationSeconds: sourceDurationSeconds,
    aspectRatio,
    keepOriginalSound,
    matchBackground,
    frameImage,
  });

  const { data: row, error: insertError } = await supabase
    .from("video_generations")
    .insert({
      user_id: user.id,
      mode: "motion",
      operation: "motion_transfer",
      model: mode.id,
      // For a frame pre-pass, repointed at the video model once the frame hands off.
      replicate_model: submission.replicateModel,
      prompt,
      params,
      source_video_path: sourceRow.output_video_path,
      credits_quoted: cost,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error("[generate-video/clone] Insert failed:", insertError);
    return NextResponse.json({ error: "Could not start clone" }, { status: 500 });
  }

  // See generate-video/route.ts's handlePOST for why this is conditional on
  // https -- its GET handler reconciles in-flight dev jobs (both clone
  // stages included) by polling instead.
  const webhookUrl = request.nextUrl.protocol === "https:" ? `${request.nextUrl.origin}/api/webhooks/replicate` : undefined;

  try {
    const { predictionId } = await submitVideoJob(submission.replicateModel, submission.input, webhookUrl);
    await supabase.from("video_generations").update({ replicate_prediction_id: predictionId }).eq("id", row.id);
  } catch (submitError) {
    const failure = describeGenerationFailure("generate-video/clone", submitError);
    await supabase.from("video_generations").update({ status: "failed", ...failure }).eq("id", row.id);
    return NextResponse.json({ error: failure.error_message }, { status: 500 });
  }

  void recordUsageEvent("video", user.id, { mode: "motion", model: mode.id, outputs: 1 });

  return NextResponse.json({ ids: [row.id] });
}

export const POST = withApiLogging("/api/generate-video/clone", handlePOST);
