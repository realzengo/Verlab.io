import { NextRequest, NextResponse } from "next/server";
import { getVideoGenerationCost } from "@/lib/config/pricing";
import { DEFAULT_VIDEO_MODEL, getVideoModel, type VideoModelConfig } from "@/lib/config/video-models";
import { getUserCredits } from "@/lib/server/credits";
import { submitVideoJob, FalVideoError } from "@/lib/server/fal-video";
import { advanceVideoJob, type VideoJobRow } from "@/lib/server/video-jobs";
import { validateReferenceImage } from "@/lib/server/video-validation";
import { recordUsageEvent } from "@/lib/server/usage";
import { withApiLogging } from "@/lib/server/api-logging";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30; // this route only submits to fal's queue and returns -- it never waits for a render (see fal-video.ts / video-jobs.ts)

// Backstop for a job that never gets finished by either the fal webhook or
// the cron sweep (see /api/cron/video-poll) -- much longer than
// generate-image's 6-minute equivalent because video renders genuinely take
// minutes, especially on premium models like Veo 3 Quality.
const STALE_JOB_MS = 20 * 60 * 1000;

interface GenerateVideoRequestBody {
  prompt?: string;
  model?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  outputs?: number;
  soundEnabled?: boolean;
  startFrameImage?: string;
  endFrameImage?: string;
}

// Formats `duration` the way each fal app's schema actually wants it --
// confirmed per model via fal's queue OpenAPI schema (see video-models.ts's
// DurationFormat doc comment). Sending the wrong shape either 422s or gets
// silently coerced, so this must branch on the model rather than assume one
// shape fits every fal app.
function formatDuration(model: VideoModelConfig, durationSeconds: number): string | number {
  switch (model.durationFormat) {
    case "suffix_s":
      return `${durationSeconds}s`;
    case "integer":
      return durationSeconds;
    case "plain_string":
      return String(durationSeconds);
  }
}

// Maps this app's generic Create-tab params onto the body each fal video app
// expects. Field names are live-verified per model against fal's queue
// OpenAPI schema -- same discipline as video-models.ts's own falSlug
// disclosure.
function buildFalCreateInput(
  model: VideoModelConfig,
  params: {
    prompt?: string;
    aspectRatio: string;
    durationSeconds: number;
    soundEnabled: boolean;
    startFrameImage?: string | null;
    endFrameImage?: string | null;
  }
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    aspect_ratio: params.aspectRatio,
    duration: formatDuration(model, params.durationSeconds),
  };
  if (params.prompt) input.prompt = params.prompt;
  if (model.supportsAudio) input.generate_audio = params.soundEnabled;
  // fal's image params accept a data-URI string directly, no upload step
  // needed (same behavior fal-image.ts already relies on for image_urls).
  // Field name isn't uniform across providers (video-models.ts's
  // startFrameField doc comment has the per-model rationale), so it must be
  // looked up rather than assumed.
  if (params.startFrameImage) input[model.startFrameField ?? "image_url"] = params.startFrameImage;
  if (params.endFrameImage && model.supportsEndFrame) input[model.endFrameField ?? "end_image_url"] = params.endFrameImage;
  return input;
}

// The start/end frame conditioning fields above only exist on each
// provider's dedicated image-to-video endpoint (see video-models.ts's
// imageToVideoFalSlug doc comment) -- the plain text-to-video falSlug either
// 422s or silently ignores them, so a start frame must route to the other
// endpoint, not just add fields to the same one.
function resolveFalSlug(model: VideoModelConfig, hasStartFrame: boolean): string {
  if (hasStartFrame && model.imageToVideoFalSlug) return model.imageToVideoFalSlug;
  return model.falSlug;
}

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get("mode");
  if (mode && !["create", "edit", "motion"].includes(mode)) {
    return NextResponse.json({ error: "mode must be one of create, edit, motion" }, { status: 400 });
  }

  const HISTORY_COLUMNS =
    "id, mode, operation, model, prompt, params, output_video_path, thumbnail_path, status, error_message, credits_quoted, created_at";

  let query = supabase.from("video_generations").select(HISTORY_COLUMNS).order("created_at", { ascending: false }).limit(50);
  if (mode) query = query.eq("mode", mode);

  const { data, error } = await query;
  if (error) {
    console.error("[generate-video] Failed to load history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Vercel Cron (the /api/cron/video-poll backstop that normally finishes
  // these rows) never fires against `next dev`, and fal's webhook can't
  // reach localhost either -- so without this, a locally-submitted job sits
  // in queued/processing until the STALE_JOB_MS timeout below. Reconciling
  // in-flight rows on the same endpoint the client already polls every 4s
  // (see VideoGenerator.tsx's pollGenerationStatus) needs no extra process.
  // Dev-only: production has the real cron + webhook doing this.
  if (process.env.NODE_ENV === "development") {
    const inFlightIds = data.filter((row) => row.status === "queued" || row.status === "processing").map((row) => row.id);

    if (inFlightIds.length > 0) {
      const admin = createAdminClient();
      const { data: fullRows } = await admin
        .from("video_generations")
        .select("id, user_id, mode, model, fal_model_slug, fal_request_id, status, credits_quoted, credits_charged")
        .in("id", inFlightIds)
        .not("fal_request_id", "is", null)
        .returns<VideoJobRow[]>();

      if (fullRows && fullRows.length > 0) {
        await Promise.all(fullRows.map((row) => advanceVideoJob(row, admin)));

        let refreshQuery = supabase.from("video_generations").select(HISTORY_COLUMNS).order("created_at", { ascending: false }).limit(50);
        if (mode) refreshQuery = refreshQuery.eq("mode", mode);
        const { data: refreshed, error: refreshError } = await refreshQuery;
        if (!refreshError && refreshed) {
          return NextResponse.json({ generations: refreshed });
        }
      }
    }
  }

  const staleIds = data
    .filter(
      (row) => (row.status === "queued" || row.status === "processing") && Date.now() - new Date(row.created_at).getTime() > STALE_JOB_MS
    )
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const timeoutMessage = "Generation timed out. Please try again.";
    await supabase.from("video_generations").update({ status: "failed", error_message: timeoutMessage }).in("id", staleIds);
    for (const row of data) {
      if (staleIds.includes(row.id)) {
        row.status = "failed";
        row.error_message = timeoutMessage;
      }
    }
  }

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

  let body: GenerateVideoRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, model: modelId = DEFAULT_VIDEO_MODEL, durationSeconds, aspectRatio, outputs, soundEnabled = false } = body;

  const model = getVideoModel(modelId);
  if (!model) {
    return NextResponse.json({ error: "model must be one of the supported options" }, { status: 400 });
  }

  if (!durationSeconds || !model.durations.includes(durationSeconds)) {
    return NextResponse.json({ error: `duration must be one of: ${model.durations.join(", ")}` }, { status: 400 });
  }

  if (!aspectRatio || !model.aspectRatios.includes(aspectRatio)) {
    return NextResponse.json({ error: `aspectRatio must be one of: ${model.aspectRatios.join(", ")}` }, { status: 400 });
  }

  if (!Number.isInteger(outputs) || outputs! < 1 || outputs! > 4) {
    return NextResponse.json({ error: "outputs must be an integer between 1 and 4" }, { status: 400 });
  }

  let startFrameImage: string | null;
  let endFrameImage: string | null;
  try {
    startFrameImage = validateReferenceImage(body.startFrameImage, "startFrameImage");
    endFrameImage = validateReferenceImage(body.endFrameImage, "endFrameImage");
  } catch (validationError) {
    return NextResponse.json({ error: (validationError as Error).message }, { status: 400 });
  }

  if (endFrameImage && !model.supportsEndFrame) {
    return NextResponse.json({ error: `${model.id} doesn't support an end frame` }, { status: 400 });
  }
  if (!prompt?.trim() && !startFrameImage && !endFrameImage) {
    return NextResponse.json({ error: "prompt is required unless a start or end frame image is provided" }, { status: 400 });
  }
  if (startFrameImage && !model.supportsImageToVideo) {
    return NextResponse.json({ error: `${model.id} doesn't support image-to-video` }, { status: 400 });
  }

  const perOutputCost = getVideoGenerationCost({ model: model.id, durationSeconds, outputs: 1 });
  const totalCost = perOutputCost * outputs!;

  // Checked synchronously, same rationale as generate-image/route.ts: this
  // response is sent long before any render finishes, so a balance check
  // made later (inside the webhook/cron completion path) would have no way
  // to tell the client "insufficient credits" with a 402.
  const balance = await getUserCredits(user.id);
  if (balance < totalCost) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  const operation = startFrameImage || endFrameImage ? "image_to_video" : "text_to_video";
  const falSlug = resolveFalSlug(model, Boolean(startFrameImage));
  const webhookUrl = `${request.nextUrl.origin}/api/webhooks/fal`;
  const falInput = buildFalCreateInput(model, {
    prompt,
    aspectRatio,
    durationSeconds,
    soundEnabled,
    startFrameImage,
    endFrameImage,
  });

  const rowIds: string[] = [];
  const failures: string[] = [];

  // Each output is its own fal job (fal has no concept of "N videos, one
  // job" the way image models take num_images) -- and each one arrives on
  // its own schedule, so each gets its own video_generations row rather
  // than being bundled into one row's array like image_generations.images.
  for (let i = 0; i < outputs!; i++) {
    const { data: row, error: insertError } = await supabase
      .from("video_generations")
      .insert({
        user_id: user.id,
        mode: "create",
        operation,
        model: model.id,
        fal_model_slug: falSlug,
        prompt: prompt ?? null,
        params: { durationSeconds, aspectRatio, soundEnabled: model.supportsAudio ? soundEnabled : false, outputs },
        credits_quoted: perOutputCost,
        status: "queued",
      })
      .select("id")
      .single();

    if (insertError || !row) {
      console.error("[generate-video] Insert failed:", insertError);
      failures.push(insertError?.message ?? "Could not start generation");
      continue;
    }

    try {
      const { requestId } = await submitVideoJob(falSlug, falInput, webhookUrl);
      await supabase.from("video_generations").update({ fal_request_id: requestId }).eq("id", row.id);
      rowIds.push(row.id);
    } catch (submitError) {
      console.error("[generate-video] submitVideoJob failed:", submitError);
      const message = submitError instanceof FalVideoError ? submitError.message : "Could not start generation";
      await supabase.from("video_generations").update({ status: "failed", error_message: message }).eq("id", row.id);
      failures.push(message);
    }
  }

  if (rowIds.length === 0) {
    return NextResponse.json({ error: failures[0] ?? "Could not start generation" }, { status: 500 });
  }

  void recordUsageEvent("video", user.id, { mode: "create", model: model.id, outputs: rowIds.length });

  return NextResponse.json({ ids: rowIds });
}

export const GET = withApiLogging("/api/generate-video", handleGET);
export const POST = withApiLogging("/api/generate-video", handlePOST);
