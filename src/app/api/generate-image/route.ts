import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { generateImages, IMAGE_MODEL_MAP, resolveQualityModel } from "@/lib/server/cloudflare-image";
import { getImageGenerationCost, slugifyModelName, type ImageQuality, type ImageResolution } from "@/lib/config/pricing";
import { chargeUser, getUserCredits } from "@/lib/server/credits";
import { recordUsageEvent } from "@/lib/server/usage";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { sweepStaleRows } from "@/lib/server/generation-sweep";
import { createClient } from "@/lib/supabase/server";
import { describeGenerationFailure } from "@/lib/server/generation-error";
import { isSafeFreeText } from "@/lib/validation";

const PROMPT_MAX = 4000;

export const maxDuration = 300;

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];
const QUALITIES = ["auto", "low", "medium", "high"];
const RESOLUTIONS = ["512px", "1K", "2K", "4K"];

interface GenerateImageRequestBody {
  prompt?: string;
  model?: string;
  aspectRatio?: string;
  outputs?: number;
  quality?: string;
  resolution?: string;
  referenceImages?: string[];
}

const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;
// Matches EDIT_VIDEO_MODELS' maxReferenceImages convention (video-models.ts)
// -- Replicate's Nano Banana / GPT Image 2 models (see replicate-image.ts)
// accept more, but this keeps prompt-following reasonable and the request
// body bounded.
const MAX_REFERENCE_IMAGES = 4;
const DATA_URL_PATTERN = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;
const ALLOWED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

// The after() background job (see POST below) is what normally flips a row
// out of "generating" -- but nothing guarantees it gets to run: a redeploy,
// an uncaught crash, or the platform hard-killing the invocation once
// maxDuration (300s) elapses all skip its catch block, leaving the row
// stuck at "generating" forever with a client poller watching it that never
// gets a non-"generating" answer. This is the fix for that: any row still
// "generating" well past the point it could plausibly still be running gets
// swept to "failed" right here, so every GET this list is fetched through
// is also the reconciliation pass -- the row can never be orphaned longer
// than one poll interval.
const STALE_GENERATING_MS = 6 * 60 * 1000;
const STALE_STATUSES = ["generating"] as const;

// Every row's `images` column holds full base64 data URLs (up to several MB
// each at higher resolutions/output counts) -- selecting it for up to 50
// history rows produced multi-tens-of-MB JSON responses that were slow to
// transfer and parse, which is what made the history sidebar/gallery feel
// like it hung on load. Mirrors the fix already applied to /api/library
// (see its IMAGE_SELECT comment): the list response stays byte-light and
// image bytes are served lazily, one at a time, from
// /api/library/image/[id]/[index] (which also handles server-side
// thumbnail resizing via a `?w=` param). The one place a caller genuinely
// needs the full `images` array for a row it already knows the id of --
// polling a specific generation through to completion -- uses the `?id=`
// path below instead, which does select it.
const LIST_SELECT = "id, prompt, model, aspect_ratio, outputs, status, error_message, created_at";
const DETAIL_SELECT = `${LIST_SELECT}, images`;

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    const { data, error } = await supabase.from("image_generations").select(DETAIL_SELECT).eq("id", id).maybeSingle();

    if (error) {
      return serverError("generate-image GET (single)", error);
    }
    if (!data) {
      return NextResponse.json({ generations: [] });
    }

    await sweepStaleRows(supabase, "image_generations", [data], STALE_STATUSES, STALE_GENERATING_MS);
    return NextResponse.json({ generations: [data] });
  }

  const { data, error } = await supabase
    .from("image_generations")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return serverError("generate-image GET (history)", error);
  }

  await sweepStaleRows(supabase, "image_generations", data, STALE_STATUSES, STALE_GENERATING_MS);

  return NextResponse.json({ generations: data });
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`generate-image:${user.id}`, 10, 60))) {
    return rateLimitedResponse();
  }

  // Base64 inflates bytes by ~4/3, so this is the JSON-body ceiling implied
  // by MAX_REFERENCE_IMAGES * MAX_REFERENCE_IMAGE_BYTES -- checked against
  // the declared Content-Length before request.json() buffers the whole
  // body into memory, with headroom for the JSON wrapper/prompt text.
  const MAX_REQUEST_BODY_BYTES = Math.ceil((MAX_REFERENCE_IMAGES * MAX_REFERENCE_IMAGE_BYTES * 4) / 3) + 64 * 1024;
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: GenerateImageRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, model, aspectRatio, outputs, quality = "auto", resolution = "1K", referenceImages } = body;

  if (!prompt || !prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  if (!isSafeFreeText(prompt, PROMPT_MAX)) {
    return NextResponse.json({ error: `prompt must be ${PROMPT_MAX} characters or fewer and contain no control characters or HTML tags` }, { status: 400 });
  }

  if (!model || !(model in IMAGE_MODEL_MAP)) {
    return NextResponse.json({ error: "model must be one of the supported options" }, { status: 400 });
  }

  if (!aspectRatio || !ASPECT_RATIOS.includes(aspectRatio)) {
    return NextResponse.json({ error: "aspectRatio must be one of the supported options" }, { status: 400 });
  }

  if (!Number.isInteger(outputs) || outputs! < 1 || outputs! > 4) {
    return NextResponse.json({ error: "outputs must be an integer between 1 and 4" }, { status: 400 });
  }

  if (!QUALITIES.includes(quality)) {
    return NextResponse.json({ error: "quality must be one of the supported options" }, { status: 400 });
  }

  if (!RESOLUTIONS.includes(resolution)) {
    return NextResponse.json({ error: "resolution must be one of the supported options" }, { status: 400 });
  }

  if (referenceImages !== undefined) {
    if (!Array.isArray(referenceImages) || referenceImages.length > MAX_REFERENCE_IMAGES) {
      return NextResponse.json({ error: `referenceImages must be an array of at most ${MAX_REFERENCE_IMAGES} images` }, { status: 400 });
    }
    for (const referenceImage of referenceImages) {
      if (typeof referenceImage !== "string" || !DATA_URL_PATTERN.test(referenceImage)) {
        return NextResponse.json({ error: "referenceImages must be base64 image data URLs" }, { status: 400 });
      }
      const approxBytes = (referenceImage.length * 3) / 4;
      if (approxBytes > MAX_REFERENCE_IMAGE_BYTES) {
        return NextResponse.json({ error: "Each reference image must be under 8MB" }, { status: 400 });
      }

      // The data-URL prefix above is just a label the client attached to the
      // payload -- it isn't verified against the actual bytes. Decode and
      // sniff the real image header with sharp so a mislabeled/spoofed file
      // (e.g. an arbitrary blob wrapped in "data:image/png;base64,") can't
      // reach the downstream model provider as if it were a real image.
      const base64Payload = referenceImage.slice(referenceImage.indexOf(",") + 1);
      const imageBuffer = Buffer.from(base64Payload, "base64");
      try {
        const { format } = await sharp(imageBuffer).metadata();
        if (!format || !ALLOWED_IMAGE_FORMATS.has(format)) {
          return NextResponse.json({ error: "referenceImages must be valid JPEG, PNG, WebP, or GIF images" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "referenceImages must be valid image files" }, { status: 400 });
      }
    }
  }

  // Cost is computed against the model that will actually run, not the one
  // picked in the dropdown -- Nano Banana 2 at medium/high quality resolves
  // to Nano Banana Pro under the hood (see resolveQualityModel /
  // QUALITY_MODEL_LADDER in cloudflare-image.ts), which is a real, far more
  // expensive fal.ai/Cloudflare call.
  const resolvedModel = resolveQualityModel(model, quality);
  const cost = getImageGenerationCost({
    model: resolvedModel,
    resolution: resolution as ImageResolution,
    quality: quality as ImageQuality,
    outputs: outputs!,
    hasReferenceImage: Boolean(referenceImages?.length),
  });

  // Checked synchronously (not inside the after() callback below) because
  // the response for this request is sent before generation finishes — by
  // the time we'd know the balance was too low in the background, there'd
  // be no way left to tell the client with a 402.
  const balance = await getUserCredits(user.id);
  if (balance < cost) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  // Generation can take minutes (Nano Banana Pro / flux-2-dev especially --
  // see cloudflare-image.ts). Holding the HTTP response open that long is
  // unreliable: a proxy, gateway, or the browser itself can kill an idle
  // connection well before generation finishes, which used to make the UI's
  // pending tile vanish while the server kept working in the background and
  // wrote the result to the DB minutes later with no way for the client to
  // find out. Instead, insert a `generating` row and respond immediately;
  // the client polls GET for this row's status the same way niche-bend jobs
  // are polled (see niche-bend-job-store.ts).
  const { data: row, error: insertError } = await supabase
    .from("image_generations")
    .insert({
      user_id: user.id,
      prompt,
      model,
      aspect_ratio: aspectRatio,
      outputs,
      images: [],
      status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    return serverError("generate-image POST insert", insertError, "Could not start generation");
  }

  // `after()` (not a bare fire-and-forget call) keeps the serverless
  // invocation alive until generation settles, instead of Vercel freezing it
  // the instant the response above is flushed.
  after(async () => {
    try {
      const images = await generateImages({
        prompt,
        model,
        aspectRatio,
        outputs: outputs!,
        quality: quality as "auto" | "low" | "medium" | "high",
        resolution: resolution as "512px" | "1K" | "2K" | "4K",
        referenceImages,
      });
      recordUsageEvent("image", user.id, { model, aspectRatio, outputs });
      try {
        await chargeUser(user.id, cost, "Image Generation", `image.${slugifyModelName(resolvedModel)}`);
      } catch (creditError) {
        // The image was already generated (Cloudflare already spent) — a
        // ledger failure here shouldn't undo that or fail the request.
        console.error("[credits] Failed to deduct for image generation:", creditError);
      }
      await supabase.from("image_generations").update({ images, status: "completed" }).eq("id", row.id);
    } catch (error) {
      await supabase
        .from("image_generations")
        .update({ status: "failed", ...describeGenerationFailure("generate-image", error) })
        .eq("id", row.id);
    }
  });

  return NextResponse.json({ id: row.id });
}

export const GET = withApiLogging("/api/generate-image", handleGET);
export const POST = withApiLogging("/api/generate-image", handlePOST);
