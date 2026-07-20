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
// turn into a multi-minute (or timed-out) request on those.
export const IMAGE_MODEL_MAP: Record<string, { id: string; format: "json" | "multipart"; maxDimension: number }> = {
  "Nano Banana": { id: "@cf/black-forest-labs/flux-1-schnell", format: "json", maxDimension: 2048 },
  "Nano Banana 2": { id: "@cf/leonardo/lucid-origin", format: "json", maxDimension: 2496 },
  "Nano Banana Pro": { id: "@cf/black-forest-labs/flux-2-dev", format: "multipart", maxDimension: 1536 },
  "Nano Banana 2 Lite": { id: "@cf/bytedance/stable-diffusion-xl-lightning", format: "json", maxDimension: 2048 },
  "GPT Image 2": { id: "@cf/black-forest-labs/flux-2-klein-9b", format: "multipart", maxDimension: 1536 },
};

// `quality` isn't a real Cloudflare param (confirmed live -- passing it to
// any of these models' /ai/run/ endpoint is silently ignored). Only offered
// in the UI for Nano Banana 2 / GPT Image 2, so each tier maps to a real
// model swap instead, worst-to-best. Both only have 1 real upgrade rung
// available (Pro's model), so Auto/Low resolve to the base model and
// Medium/High both resolve to the upgrade -- there's no real 3rd/4th model
// to fake a finer gradation with.
const QUALITY_MODEL_LADDER: Record<string, string[]> = {
  "Nano Banana 2": ["Nano Banana 2", "Nano Banana Pro"],
  "GPT Image 2": ["GPT Image 2", "Nano Banana Pro"],
};

const QUALITY_TIER_INDEX: Record<string, number> = { auto: 0, low: 0, medium: 1, high: Infinity };

function resolveQualityModel(model: string, quality: string): string {
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

async function runOnce(
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

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${entry.id}`, init);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
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

export async function generateImages({
  prompt,
  model,
  aspectRatio,
  outputs,
  quality,
  resolution,
}: GenerateImagesParams): Promise<string[]> {
  const resolvedModel = resolveQualityModel(model, quality);
  const entry = IMAGE_MODEL_MAP[resolvedModel];
  const { width, height } = resolveDimensions(aspectRatio, resolution, entry.maxDimension);

  return Promise.all(Array.from({ length: outputs }, () => runOnce(entry, prompt, width, height)));
}
