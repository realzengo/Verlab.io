import { generateImageWithFal, hasFalFallback } from "./fal-image";

// Cloudflare Workers AI text-to-image models. There is no @cf/google/
// "nano-banana" family on this account (verified live against Cloudflare's
// /ai/models/search — 0 results for "nano", and Google's only 4 models
// there are text/embedding, not image). Mapped instead to real models from
// Cloudflare's Text-to-Image catalog, tier-matched to the dropdown labels:
//   Lite    -> stable-diffusion-xl-lightning (fastest, free per step)
//   base    -> flux-1-schnell (fast, good general quality)
//   default -> leonardo/lucid-origin (higher quality, used as the UI default)
//   Pro     -> flux-2-dev (best quality, needs multipart instead of JSON)
// Each entry's `format` reflects how that specific model's /ai/run/ endpoint
// actually behaves (confirmed via live test calls) -- some want a JSON body
// and reply with `{ result: { image: base64 } }`, others want a JSON body
// but reply with raw image bytes, and flux-2-dev specifically 400s on JSON
// ("required properties at '/' are 'multipart'") and needs multipart/form-data.
//
// "GPT Image 2" is the same situation: there is no OpenAI image model on
// this account either (search for "gpt"/"openai" only turns up the
// gpt-oss-120b/20b *text* models). Mapped to flux-2-klein-9b instead --
// also needs multipart/form-data (confirmed live, same 400 as flux-2-dev
// on JSON), replies with JSON+base64.
// `maxDimension` is each model's real, live-confirmed ceiling on width/height
// (Cloudflare 400s past it): lucid-origin errors above 2500 ("/height must be
// <= 2500"), flux-1-schnell/sdxl-lightning were confirmed fine at 2048 (not
// pushed further), and the flux-2-* multipart models were still running
// past 2 minutes at 2048x2048 -- capped low here so the "4K" tier doesn't
// turn into a multi-minute (or timed-out) request on those. Nano Banana Pro
// (flux-2-dev) was still slow even at 1536, so it's capped further to 1024
// to keep generation time reasonable.
export const IMAGE_MODEL_MAP: Record<string, { id: string; format: "json" | "multipart"; maxDimension: number }> = {
  "Nano Banana": { id: "@cf/black-forest-labs/flux-1-schnell", format: "json", maxDimension: 2048 },
  "Nano Banana 2": { id: "@cf/leonardo/lucid-origin", format: "json", maxDimension: 2496 },
  "Nano Banana Pro": { id: "@cf/black-forest-labs/flux-2-dev", format: "multipart", maxDimension: 1024 },
  "Nano Banana 2 Lite": { id: "@cf/bytedance/stable-diffusion-xl-lightning", format: "json", maxDimension: 2048 },
  "GPT Image 2": { id: "@cf/black-forest-labs/flux-2-klein-9b", format: "multipart", maxDimension: 1536 },
};

// `quality` isn't a real Cloudflare param (confirmed live -- passing it to
// any of these models' /ai/run/ endpoint is silently ignored), and Nano
// Banana 2 has no fal.ai equivalent with a real quality knob, so for that
// tier "Quality" maps to a real model swap instead, worst-to-best (only 1
// real upgrade rung available -- Pro's model -- so Auto/Low resolve to the
// base model and Medium/High both resolve to the upgrade). GPT Image 2 used
// to work the same way, but fal.ai's openai/gpt-image-2 has its own genuine
// `quality: auto/low/medium/high` param (see fal-image.ts) -- swapping it
// away to a different model/company entirely on Medium/High was actively
// wrong once that became available, so it's deliberately left out of this
// ladder and its quality value is passed straight through instead.
const QUALITY_MODEL_LADDER: Record<string, string[]> = {
  "Nano Banana 2": ["Nano Banana 2", "Nano Banana Pro"],
};

const QUALITY_TIER_INDEX: Record<string, number> = { auto: 0, low: 0, medium: 1, high: Infinity };

export function resolveQualityModel(model: string, quality: string): string {
  const ladder = QUALITY_MODEL_LADDER[model];
  if (!ladder) return model;
  const index = Math.min(QUALITY_TIER_INDEX[quality] ?? 0, ladder.length - 1);
  return ladder[index];
}

// "Resolution" isn't a real Cloudflare param either (`image_size`/
// `aspect_ratio` fields are silently ignored -- confirmed live: sending
// image_size: "4K" with no width/height came back at the model's own
// 1120x1120 default). The only real lever is width/height, so resolution
// tiers scale the base ~1MP bucket by total-pixel multiplier instead.
const RESOLUTION_PIXEL_MULTIPLIER: Record<string, number> = {
  "512px": 0.25,
  "1K": 1,
  "2K": 4,
  "4K": 16,
};

// SDXL-standard bucket resolutions (multiples of 32, ~1MP) -- 1:1/16:9/9:16/
// 4:3/3:2/21:9 confirmed against live Cloudflare calls; 3:4, 2:3, 4:5, 5:4
// follow the same bucket-sizing convention (untested live, but low-risk --
// unlike a wrong model id, a slightly-off resolution just gets clamped or
// 400s cleanly rather than silently misbehaving).
const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
  "4:3": { width: 1152, height: 896 },
  "3:4": { width: 896, height: 1152 },
  "3:2": { width: 1216, height: 832 },
  "2:3": { width: 832, height: 1216 },
  "4:5": { width: 896, height: 1120 },
  "5:4": { width: 1120, height: 896 },
  "21:9": { width: 1536, height: 640 },
};

interface GenerateImagesParams {
  prompt: string;
  model: string;
  aspectRatio: string;
  outputs: number;
  quality: "auto" | "low" | "medium" | "high";
  resolution: "512px" | "1K" | "2K" | "4K";
  referenceImage?: string;
}

function sniffMimeType(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return "image/jpeg";
}

function resolveDimensions(aspectRatio: string, resolution: string, maxDimension: number): { width: number; height: number } {
  const base = ASPECT_RATIO_DIMENSIONS[aspectRatio];
  const scale = Math.sqrt(RESOLUTION_PIXEL_MULTIPLIER[resolution] ?? 1);

  const round32 = (value: number) => Math.max(32, Math.round(value / 32) * 32);

  return {
    width: Math.min(round32(base.width * scale), round32(maxDimension)),
    height: Math.min(round32(base.height * scale), round32(maxDimension)),
  };
}

// Cloudflare's own safety classifier on flux-2-* output rejects a slice of
// completely benign prompts (error code 3030, "Your output has been
// flagged") -- since these models sample randomly, the same prompt often
// passes on a second attempt, so we retry once before surfacing a
// user-facing message instead of the raw Cloudflare JSON.
const OUTPUT_FLAGGED_CODE = 3030;

async function callCloudflare(
  entry: { id: string; format: "json" | "multipart" },
  prompt: string,
  width: number,
  height: number
): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  const init: RequestInit =
    entry.format === "multipart"
      ? (() => {
          const form = new FormData();
          form.append("prompt", prompt);
          form.append("width", String(width));
          form.append("height", String(height));
          return { method: "POST", headers: { Authorization: `Bearer ${apiToken}` }, body: form };
        })()
      : {
          method: "POST",
          headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, width, height }),
        };

  // Bounded so a hung Cloudflare call can't outlive the route's after()
  // maxDuration budget and get silently killed before ever reaching the
  // catch block that would mark the generation row "failed" (see the same
  // comment in fal-image.ts).
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${entry.id}`, {
    ...init,
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let code: number | undefined;
    try {
      code = JSON.parse(text)?.errors?.[0]?.code;
    } catch {
      // not JSON, leave code undefined
    }
    if (code === OUTPUT_FLAGGED_CODE) {
      const error = new Error("This prompt was flagged by the image model's safety filter. Try rephrasing it.");
      error.name = "OutputFlaggedError";
      throw error;
    }
    throw new Error(`Cloudflare Workers AI request failed (${response.status}): ${text || response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.startsWith("image/")) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    const mimeType = sniffMimeType(buffer);
    return `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;
  }

  const data = await response.json();
  const base64Image: string | undefined = data?.result?.image;
  if (!base64Image) {
    throw new Error("Cloudflare Workers AI returned an unrecognized response shape");
  }
  const mimeType = sniffMimeType(Buffer.from(base64Image, "base64"));
  return `data:${mimeType};base64,${base64Image}`;
}

// Cloudflare's flux-2-* models (what "Nano Banana Pro" and "GPT Image 2" are
// mapped to) are genuinely slow -- live-confirmed at 93s for a single
// 1024x768 flux-2-dev image, even at its already-reduced maxDimension.
// fal.ai's nano-banana-pro / openai/gpt-image-2 are the real models these
// tiers are named after, and are expected to be much faster, so for these
// two prefer fal over Cloudflare instead of only falling back to it on
// error. If fal is unavailable (e.g. exhausted balance -- see fal-image.ts)
// this just fails fast and falls through to the normal Cloudflare path
// below, so it's safe to ship ahead of fal being funded.
const PREFER_FAL_MODELS = new Set(["Nano Banana Pro", "GPT Image 2"]);

async function runOnce(
  resolvedModel: string,
  entry: { id: string; format: "json" | "multipart" },
  prompt: string,
  aspectRatio: string,
  width: number,
  height: number,
  resolution: "512px" | "1K" | "2K" | "4K",
  quality: "auto" | "low" | "medium" | "high",
  referenceImage?: string
): Promise<string> {
  // Cloudflare Workers AI has no confirmed img2img path for any of the
  // models in IMAGE_MODEL_MAP on this account -- only fal.ai's `/edit`
  // endpoints (see fal-image.ts) can actually honor a reference image. If
  // we let this fall through to the plain Cloudflare text-to-image call
  // below on error, the reference image would silently get dropped again
  // (the original bug), so a reference image always goes through fal, with
  // no Cloudflare fallback.
  if (referenceImage) {
    if (!hasFalFallback(resolvedModel)) {
      throw new Error(`${resolvedModel} doesn't support reference images yet.`);
    }
    return await generateImageWithFal(resolvedModel, prompt, aspectRatio, resolution, width, height, quality, referenceImage);
  }

  if (PREFER_FAL_MODELS.has(resolvedModel) && hasFalFallback(resolvedModel)) {
    try {
      return await generateImageWithFal(resolvedModel, prompt, aspectRatio, resolution, width, height, quality);
    } catch {
      // fall through to the Cloudflare path below as a backup
    }
  }

  try {
    return await callCloudflare(entry, prompt, width, height);
  } catch (error) {
    if (error instanceof Error && error.name === "OutputFlaggedError") {
      try {
        return await callCloudflare(entry, prompt, width, height);
      } catch (retryError) {
        error = retryError;
      }
    }
    if (hasFalFallback(resolvedModel)) {
      return await generateImageWithFal(resolvedModel, prompt, aspectRatio, resolution, width, height, quality);
    }
    throw error;
  }
}

export async function generateImages({
  prompt,
  model,
  aspectRatio,
  outputs,
  quality,
  resolution,
  referenceImage,
}: GenerateImagesParams): Promise<string[]> {
  const resolvedModel = resolveQualityModel(model, quality);
  const entry = IMAGE_MODEL_MAP[resolvedModel];
  const { width, height } = resolveDimensions(aspectRatio, resolution, entry.maxDimension);

  return Promise.all(
    Array.from({ length: outputs }, () =>
      runOnce(resolvedModel, entry, prompt, aspectRatio, width, height, resolution, quality, referenceImage)
    )
  );
}
