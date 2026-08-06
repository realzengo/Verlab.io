// Replaces fal-image.ts. Replicate hosts the real models the UI's tiers are
// named after directly, as first-party "official model" listings -- Google's
// Nano Banana family (google/nano-banana, google/nano-banana-pro) and
// OpenAI's GPT Image 2 (openai/gpt-image-2) -- confirmed to exist via
// Replicate's own text-to-image collection page as of this writing.
//
// Field names below (prompt, aspect_ratio, image_input, resolution, size,
// quality, n) are BEST-EFFORT -- Replicate's per-model schema pages render
// client-side (this environment can't execute that JS to read the real
// OpenAPI schema), so these are inferred from Replicate's own common
// conventions for these two providers' other hosted models, not
// individually confirmed the way fal-image.ts's slugs were. Verify against
// https://replicate.com/google/nano-banana-pro/api and
// https://replicate.com/openai/gpt-image-2/api before the first real deploy
// -- if a field name is wrong, Replicate 422s with the real accepted field
// list in the error body, which surfaces directly into the generation row's
// error_message (see cloudflare-image.ts's catch path), so a wrong guess
// fails loudly and is a one-line fix, not silent breakage.
import { getReplicateClient, resolveOutputUrl, downloadReplicateAsset, withReplicateRetry, ReplicateApiError } from "./replicate-client";

const REPLICATE_MODEL: Record<string, string> = {
  "Nano Banana": "google/nano-banana",
  "Nano Banana 2": "google/nano-banana-2",
  "Nano Banana 2 Lite": "google/nano-banana",
  "Nano Banana Pro": "google/nano-banana-pro",
  "GPT Image 2": "openai/gpt-image-2",
};

export function hasReplicateFallback(model: string): boolean {
  return model in REPLICATE_MODEL;
}

const RESOLUTION: Record<string, "1K" | "2K" | "4K"> = {
  "512px": "1K",
  "1K": "1K",
  "2K": "2K",
  "4K": "4K",
};

// OpenAI's gpt-image-1/2 API only accepts these three literal size strings
// (plus "auto") -- not arbitrary width/height like fal's custom wrapper
// took. Picking the closest one from the width/height this app already
// computed (see cloudflare-image.ts's resolveDimensions) rather than
// guessing a fixed size regardless of aspect ratio.
function nearestOpenAiSize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" {
  if (Math.abs(width - height) < 32) return "1024x1024";
  return width > height ? "1536x1024" : "1024x1536";
}

export async function generateImageWithReplicate(
  model: string,
  prompt: string,
  aspectRatio: string,
  resolution: "512px" | "1K" | "2K" | "4K",
  width: number,
  height: number,
  quality: "auto" | "low" | "medium" | "high",
  referenceImages?: string[]
): Promise<string> {
  const replicateModel = REPLICATE_MODEL[model];
  if (!replicateModel) throw new ReplicateApiError(`No Replicate model configured for "${model}"`);

  const hasReferenceImages = referenceImages !== undefined && referenceImages.length > 0;

  const input: Record<string, unknown> =
    replicateModel === "openai/gpt-image-2"
      ? { prompt, size: nearestOpenAiSize(width, height), quality }
      : { prompt, aspect_ratio: aspectRatio };

  if (replicateModel === "google/nano-banana-pro") {
    input.resolution = RESOLUTION[resolution];
  }

  if (hasReferenceImages) {
    // Field name for reference/edit images -- Google's Gemini image models
    // on Replicate commonly expose this as `image_input` (an array);
    // OpenAI's gpt-image-2 wrapper is more likely `input_images` to mirror
    // OpenAI's own Images API. Both are unverified guesses -- see module
    // header.
    input[replicateModel === "openai/gpt-image-2" ? "input_images" : "image_input"] = referenceImages;
  }

  const replicate = getReplicateClient();

  let output: unknown;
  try {
    // Replicate's SDK types `run()`'s model id as a `${owner}/${name}`
    // template literal -- REPLICATE_MODEL's values satisfy that shape at
    // runtime (all "owner/name"), but the Record<string,string> lookup
    // above widens it back to plain `string`, so this cast just restores
    // what TS can't re-infer through the lookup.
    // Wrapped in withReplicateRetry -- low-balance accounts get throttled to
    // a burst of 1 request/~6s (see that function's own comment).
    output = await withReplicateRetry(() => replicate.run(replicateModel as `${string}/${string}`, { input }));
  } catch (error) {
    throw new ReplicateApiError(error instanceof Error ? error.message : "Replicate prediction failed");
  }

  const imageUrl = await resolveOutputUrl(output);
  const { bytes, contentType } = await downloadReplicateAsset(imageUrl, 60_000);
  return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
}
