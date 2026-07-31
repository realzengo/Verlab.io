// fal.ai hosts the real models the UI's tiers are named after -- Google's
// "Nano Banana" family (Gemini 2.5 Flash Image / Gemini 3 Pro Image) and
// OpenAI's GPT Image 2 -- unlike Cloudflare Workers AI, which has neither
// (see cloudflare-image.ts, which maps these tiers to unrelated flux-*
// models instead). Live-confirmed against all slugs with the real
// FAL_API_KEY: 200s once funded (previously 403 "exhausted balance", not
// 404 -- auth and routing always worked).
const FAL_MODEL_SLUG: Record<string, string> = {
  "Nano Banana": "fal-ai/nano-banana",
  "Nano Banana 2": "fal-ai/nano-banana",
  "Nano Banana 2 Lite": "fal-ai/nano-banana",
  "Nano Banana Pro": "fal-ai/nano-banana-pro",
  "GPT Image 2": "openai/gpt-image-2",
};

export function hasFalFallback(model: string): boolean {
  return model in FAL_MODEL_SLUG;
}

// fal-ai/nano-banana-pro has a real `resolution` enum (1K/2K/4K, confirmed
// against fal's own API docs) -- the plain fal-ai/nano-banana slug used by
// the other tiers doesn't document this param, so it's only sent for -pro
// to avoid risking a 422 on an unrecognized field for the others. The app's
// "512px" tier has no fal equivalent below 1K, so it floors to 1K there.
const FAL_RESOLUTION: Record<string, "1K" | "2K" | "4K"> = {
  "512px": "1K",
  "1K": "1K",
  "2K": "2K",
  "4K": "4K",
};

export async function generateImageWithFal(
  model: string,
  prompt: string,
  aspectRatio: string,
  resolution: "512px" | "1K" | "2K" | "4K",
  width: number,
  height: number,
  quality: "auto" | "low" | "medium" | "high",
  referenceImage?: string
): Promise<string> {
  const apiKey = process.env.FAL_API_KEY;
  const falModel = FAL_MODEL_SLUG[model];
  // Every slug above has a sibling `/edit` endpoint that takes the same
  // params plus `image_urls` (live-confirmed for all three: fal-ai/nano-banana/edit,
  // fal-ai/nano-banana-pro/edit, openai/gpt-image-2/edit -- data-URI strings
  // work directly in image_urls, no upload step needed).
  const endpoint = referenceImage ? `${falModel}/edit` : falModel;

  // openai/gpt-image-2 doesn't take `aspect_ratio` at all (confirmed live
  // against fal's API docs) -- it wants a `image_size` object, so passing
  // the nano-banana shape here would silently ignore the user's aspect
  // ratio and always come back landscape 4:3. Reuse the width/height the
  // caller already computed from aspectRatio+resolution (same numbers the
  // Cloudflare fallback path renders at) instead of re-deriving them here.
  const body: Record<string, unknown> =
    falModel === "openai/gpt-image-2"
      ? { prompt, num_images: 1, image_size: { width, height } }
      : { prompt, num_images: 1, aspect_ratio: aspectRatio };

  if (falModel === "fal-ai/nano-banana-pro") {
    body.resolution = FAL_RESOLUTION[resolution];
  }

  // openai/gpt-image-2 has a genuine `quality: auto/low/medium/high` param
  // (confirmed against fal's own API docs) that lines up exactly with this
  // app's own Quality options -- unlike Nano Banana 2, it doesn't need a
  // model-swap ladder to fake quality tiers (see QUALITY_MODEL_LADDER in
  // cloudflare-image.ts).
  if (falModel === "openai/gpt-image-2") {
    body.quality = quality;
  }

  if (referenceImage) {
    body.image_urls = [referenceImage];
  }

  // A hung fal.ai request with no timeout used to be able to sit open past
  // the route's `after()` maxDuration (300s), which gets hard-killed by the
  // platform without ever reaching this function's catch block -- leaving
  // the DB row stuck at "generating" forever with nothing to mark it
  // failed. Bounding every outbound fetch here guarantees this function
  // always resolves or rejects well inside that budget.
  const response = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`fal.ai request failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json();
  const imageUrl: string | undefined = data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error("fal.ai returned an unrecognized response shape");
  }

  const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imageResponse.ok) {
    throw new Error(`fal.ai image download failed (${imageResponse.status})`);
  }
  const buffer = new Uint8Array(await imageResponse.arrayBuffer());
  const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
  return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
}
