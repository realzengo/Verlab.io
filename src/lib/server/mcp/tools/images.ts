import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeUser } from "@/lib/server/credits";
import { recordUsageEvent } from "@/lib/server/usage";
import { getImageGenerationCost, slugifyModelName } from "@/lib/config/pricing";
import { generateImages, IMAGE_MODEL_MAP, resolveQualityModel } from "@/lib/server/cloudflare-image";
import { hasReplicateFallback } from "@/lib/server/replicate-image";
import { describeGenerationFailure } from "@/lib/server/generation-error";
import { isSafeFreeText } from "@/lib/validation";
import { ImageInputError, resolveImageInputs } from "../image-input";
import { signMediaUrl } from "../links";
import {
  appResult,
  CREATES,
  errorResult,
  POLLING_NOTE,
  requireCredits,
  runJob,
  STATUS_CHECK,
  UUID_PATTERN,
  type McpToolDefinition,
} from "./shared";

const IMAGE_MODELS = Object.keys(IMAGE_MODEL_MAP) as [string, ...string[]];
const DEFAULT_IMAGE_MODEL = "Nano Banana 2";
const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"] as const;
const PROMPT_MAX = 4000;
const MAX_REFERENCE_IMAGES = 4;
// Same window as the web route's stuck-row sweep (generate-image/route.ts).
const STALE_GENERATING_MS = 6 * 60 * 1000;

function imagePayload(id: string, count: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    status: "completed",
    images: Array.from({ length: count }, (_, i) => signMediaUrl("image", id, i)),
    downloads: Array.from({ length: count }, (_, i) => signMediaUrl("image", id, i, { download: true })),
    refs: Array.from({ length: count }, (_, i) => `image:${id}:${i}`),
    ...extra,
  };
}

function imageText(id: string, count: number, model: string, aspectRatio: string): string {
  const refs = Array.from({ length: count }, (_, i) => `image:${id}:${i}`);
  return (
    `Generated ${count} image${count === 1 ? "" : "s"} (${model}, ${aspectRatio}), shown in the card above.\n` +
    `Image refs: ${refs.join(", ")} -- pass one to generate_video as startImage to animate it, or to generate_image as a reference.\n` +
    `Direct links: ${refs.map((_, i) => signMediaUrl("image", id, i)).join(" ")}`
  );
}

const generateImageTool: McpToolDefinition = {
  name: "generate_image",
  title: "Generate an image",
  description:
    "Generates 1-4 AI images from a text prompt (thumbnails, B-roll stills, characters, scenes). Optional reference images keep a character, product or style " +
    "consistent (Nano Banana Pro / GPT Image 2 only). Returns image refs (image:<id>:<n>) that generate_video can animate. Charges credits only when it succeeds.",
  inputSchema: {
    prompt: z.string().describe("What to generate. Be specific about subject, style, lighting and framing."),
    model: z.enum(IMAGE_MODELS).optional().describe(`Image model. Defaults to ${DEFAULT_IMAGE_MODEL}.`),
    aspectRatio: z.enum(ASPECT_RATIOS).optional().describe("Defaults to 1:1. Use 9:16 for vertical short-form, 16:9 for YouTube thumbnails."),
    outputs: z.number().int().min(1).max(4).optional().describe("Number of images, 1-4. Defaults to 1."),
    quality: z.enum(["auto", "low", "medium", "high"]).optional().describe("Defaults to auto."),
    resolution: z.enum(["512px", "1K", "2K", "4K"]).optional().describe("Defaults to 1K."),
    referenceImages: z
      .array(z.string())
      .max(MAX_REFERENCE_IMAGES)
      .optional()
      .describe("Up to 4 reference images: Verlab image refs (image:<id>:<n>) or public https image URLs."),
  },
  annotations: CREATES,
  handler: async (userId, args) => {
    const prompt = String(args.prompt ?? "").trim();
    if (!prompt) return errorResult("Describe the image you want.", "invalid_input");
    if (!isSafeFreeText(prompt, PROMPT_MAX)) {
      return errorResult(`The prompt must be ${PROMPT_MAX} characters or fewer, without HTML tags.`, "invalid_input");
    }

    const model = typeof args.model === "string" && args.model in IMAGE_MODEL_MAP ? args.model : DEFAULT_IMAGE_MODEL;
    const aspectRatio = (ASPECT_RATIOS as readonly string[]).includes(String(args.aspectRatio)) ? String(args.aspectRatio) : "1:1";
    const outputs = Math.min(4, Math.max(1, Number(args.outputs) || 1));
    const quality = (["auto", "low", "medium", "high"] as const).find((q) => q === args.quality) ?? "auto";
    const resolution = (["512px", "1K", "2K", "4K"] as const).find((r) => r === args.resolution) ?? "1K";
    const resolvedModel = resolveQualityModel(model, quality);

    const rawReferences = Array.isArray(args.referenceImages) ? args.referenceImages.map(String).filter(Boolean) : [];
    if (rawReferences.length && !hasReplicateFallback(resolvedModel)) {
      return errorResult(`${model} can't use reference images. Use Nano Banana Pro or GPT Image 2 for that.`, "invalid_input");
    }
    let referenceImages: string[] = [];
    try {
      referenceImages = await resolveImageInputs(userId, rawReferences);
    } catch (error) {
      if (error instanceof ImageInputError) return errorResult(error.message, "invalid_input");
      throw error;
    }

    const cost = getImageGenerationCost({ model: resolvedModel, resolution, quality, outputs, hasReferenceImage: referenceImages.length > 0 });
    const lacking = await requireCredits(userId, cost);
    if (lacking) return lacking;

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("image_generations")
      .insert({ user_id: userId, prompt, model, aspect_ratio: aspectRatio, outputs, images: [], status: "generating" })
      .select("id")
      .single();
    if (insertError || !row) return errorResult("Couldn't start the image generation. Please try again.");

    let failureMessage = "The image generation failed.";
    const outcome = await runJob(
      async () => {
        const images = await generateImages({
          prompt,
          model,
          aspectRatio,
          outputs,
          quality,
          resolution,
          referenceImages: referenceImages.length ? referenceImages : undefined,
        });
        await admin.from("image_generations").update({ images, status: "completed" }).eq("id", row.id);
        await chargeUser(userId, cost, "Image Generation", `image.${slugifyModelName(resolvedModel)}`).catch((error) =>
          console.error("[mcp/generate_image] charge failed:", error)
        );
        recordUsageEvent("image", userId, { model, aspectRatio, outputs, source: "mcp" });
        return images.length;
      },
      async (error) => {
        const failure = describeGenerationFailure("mcp/generate_image", error);
        failureMessage = failure.error_message;
        await admin.from("image_generations").update({ status: "failed", ...failure }).eq("id", row.id);
      }
    );

    const meta = { model, aspectRatio, prompt, cost };
    if (outcome.state === "running") {
      return appResult(`Generating the image now (generation ${row.id}). ${POLLING_NOTE}`, {
        id: row.id,
        status: "generating",
        outputs,
        ...meta,
      });
    }
    if (outcome.state === "failed") return errorResult(`${failureMessage} Nothing was charged.`);
    return appResult(imageText(row.id, outcome.value, model, aspectRatio), imagePayload(row.id, outcome.value, meta));
  },
};

const checkImageStatusTool: McpToolDefinition = {
  name: "check_image_status",
  title: "Check image generation status",
  description: "Checks an in-progress generate_image call by its id. The image card polls this itself.",
  inputSchema: { id: z.string() },
  annotations: STATUS_CHECK,
  handler: async (userId, args) => {
    const id = String(args.id ?? "").trim();
    if (!UUID_PATTERN.test(id)) return errorResult("That isn't a valid image generation id.", "invalid_input");
    const admin = createAdminClient();
    // `images` (the data URLs) is deliberately not selected -- `outputs` is the count.
    const { data } = await admin
      .from("image_generations")
      .select("id, status, outputs, model, prompt, aspect_ratio, error_message, created_at")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return errorResult("That image generation wasn't found.", "not_found");

    let status = String(data.status);
    let failure = data.error_message as string | null;
    if (status === "generating" && Date.now() - new Date(data.created_at).getTime() > STALE_GENERATING_MS) {
      failure = "Generation timed out. Please try again.";
      await admin.from("image_generations").update({ status: "failed", error_message: failure }).eq("id", id).eq("status", "generating");
      status = "failed";
    }

    if (status === "failed") return errorResult(`${failure ?? "The image generation failed."} Nothing was charged.`);
    const meta = { model: data.model, aspectRatio: data.aspect_ratio, prompt: data.prompt };
    if (status !== "completed") {
      return appResult(`Still generating. ${POLLING_NOTE}`, { id, status: "generating", outputs: data.outputs, ...meta });
    }
    const count = Math.max(1, Number(data.outputs) || 1);
    return appResult(imageText(id, count, String(data.model), String(data.aspect_ratio ?? "1:1")), imagePayload(id, count, meta));
  },
};

export const IMAGE_TOOLS: McpToolDefinition[] = [generateImageTool, checkImageStatusTool];
