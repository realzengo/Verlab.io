import { NextRequest, NextResponse } from "next/server";
import { getVideoPromptEditCost } from "@/lib/config/pricing";
import { getEditVideoModel } from "@/lib/config/video-models";
import { getUserCredits } from "@/lib/server/credits";
import { submitVideoJob } from "@/lib/server/replicate-video";
import { validateReferenceImage } from "@/lib/server/video-validation";
import { describeGenerationFailure, GENERIC_GENERATION_ERROR } from "@/lib/server/generation-error";
import { recordUsageEvent } from "@/lib/server/usage";
import { withApiLogging } from "@/lib/server/api-logging";
import { isSafeFreeText, FREE_TEXT_MAX } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

const STORAGE_BUCKET = "videos";
// Long enough for Replicate to fetch the video promptly after we submit the
// job (well before this expires) without minting a URL that outlives its need.
const SOURCE_SIGNED_URL_TTL_SECONDS = 15 * 60;

interface GenerateVideoEditRequestBody {
  sourceGenerationId?: string;
  prompt?: string;
  model?: string;
  referenceImages?: string[];
  outputs?: number;
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: GenerateVideoEditRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sourceGenerationId, prompt, model: modelId, outputs } = body;

  const model = getEditVideoModel(modelId ?? "");
  if (!model) {
    return NextResponse.json({ error: "model must be one of the supported edit models" }, { status: 400 });
  }

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  // Edit models have no confirmed per-model prompt-length cap (see
  // PromptEditModelConfig in video-models.ts), so this only enforces
  // character safety plus the shared free-text default length.
  if (!isSafeFreeText(prompt, FREE_TEXT_MAX)) {
    return NextResponse.json({ error: "prompt contains characters that aren't allowed" }, { status: 400 });
  }

  if (!sourceGenerationId || typeof sourceGenerationId !== "string") {
    return NextResponse.json({ error: "sourceGenerationId is required" }, { status: 400 });
  }

  if (!Number.isInteger(outputs) || outputs! < 1 || outputs! > 4) {
    return NextResponse.json({ error: "outputs must be an integer between 1 and 4" }, { status: 400 });
  }

  const rawReferenceImages = Array.isArray(body.referenceImages) ? body.referenceImages : [];
  if (rawReferenceImages.length > model.maxReferenceImages) {
    return NextResponse.json({ error: `${model.id} accepts at most ${model.maxReferenceImages} reference images` }, { status: 400 });
  }

  let referenceImages: string[];
  try {
    referenceImages = rawReferenceImages.map((image, index) => {
      const validated = validateReferenceImage(image, `referenceImages[${index}]`);
      if (!validated) throw new Error(`referenceImages[${index}] must be a base64 image data URL`);
      return validated;
    });
  } catch (validationError) {
    return NextResponse.json({ error: (validationError as Error).message }, { status: 400 });
  }

  const { data: sourceRow } = await supabase
    .from("video_generations")
    .select("status, output_video_path, params")
    .eq("id", sourceGenerationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sourceRow) {
    return NextResponse.json({ error: "Source video not found" }, { status: 404 });
  }
  if (sourceRow.status !== "completed" || !sourceRow.output_video_path) {
    return NextResponse.json({ error: "Source video isn't ready yet" }, { status: 400 });
  }

  const sourceDurationSeconds: number | undefined = (sourceRow.params as { durationSeconds?: number } | null)?.durationSeconds;
  if (!sourceDurationSeconds) {
    return NextResponse.json({ error: "Source video has no known duration" }, { status: 400 });
  }
  if (sourceDurationSeconds < model.minSourceDurationSeconds || sourceDurationSeconds > model.maxSourceDurationSeconds) {
    return NextResponse.json(
      {
        error: `${model.id} requires a ${model.minSourceDurationSeconds}-${model.maxSourceDurationSeconds}s source video (this one is ${sourceDurationSeconds}s)`,
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const perOutputCost = getVideoPromptEditCost({ model: model.id, sourceDurationSeconds, outputs: 1 });
  const totalCost = perOutputCost * outputs!;

  // Checked synchronously, same rationale as /api/generate-video's create
  // path: the response returns long before any render finishes.
  const balance = await getUserCredits(user.id);
  if (balance < totalCost) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  const { data: signedSource, error: signError } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(sourceRow.output_video_path, SOURCE_SIGNED_URL_TTL_SECONDS);

  if (signError || !signedSource) {
    console.error("[generate-video/edit] Failed to sign source video URL:", signError);
    return NextResponse.json({ error: "Could not load source video" }, { status: 500 });
  }

  // Replicate's image params accept a data-URI string directly (same as
  // Create's start/end frames in generate-video/route.ts's
  // buildReplicateCreateInput) -- only the source video needs a real
  // fetchable URL, since it's already sitting in our own private bucket
  // rather than freshly uploaded by the client this request. Field names are
  // per-model (videoField/referenceImagesField -- see EDIT_VIDEO_MODELS in
  // video-models.ts): Replicate silently drops fields it doesn't recognize
  // instead of rejecting the request, so a wrong key here doesn't error, it
  // just makes the model render from the prompt alone with no real video
  // conditioning. That's bitten Kling Edit twice now (see its entry in
  // video-models.ts for the second, schema-verified fix) -- these two fall
  // back to a "video_url"/"image_urls" guess only for models that haven't
  // had their real field names confirmed live yet. `extraInputFields` layers
  // in any other static fields a model's schema requires beyond just naming
  // the video/prompt/images (e.g. Kling's `video_reference_type: "base"`,
  // without which it treats the source as a loose style reference instead
  // of footage to actually edit).
  const replicateInput: Record<string, unknown> = {
    ...model.extraInputFields,
    [model.videoField ?? "video_url"]: signedSource.signedUrl,
    prompt: prompt.trim(),
  };
  if (referenceImages.length > 0) replicateInput[model.referenceImagesField ?? "image_urls"] = referenceImages;

  // See generate-video/route.ts's handlePOST for why this is conditional on
  // https -- Replicate 422s on submit for a non-HTTPS webhook (localhost in
  // dev), and that route's GET handler (mode=edit included) already
  // reconciles in-flight dev jobs by polling as a stand-in for the webhook.
  const webhookUrl = request.nextUrl.protocol === "https:" ? `${request.nextUrl.origin}/api/webhooks/replicate` : undefined;
  const rowIds: string[] = [];
  const failures: string[] = [];

  // Each output is its own Replicate prediction, same rationale as Create's
  // loop in generate-video/route.ts.
  for (let i = 0; i < outputs!; i++) {
    const { data: row, error: insertError } = await supabase
      .from("video_generations")
      .insert({
        user_id: user.id,
        mode: "edit",
        operation: "prompt_edit",
        model: model.id,
        replicate_model: model.replicateModel,
        prompt: prompt.trim(),
        params: { sourceGenerationId, durationSeconds: sourceDurationSeconds, referenceImageCount: referenceImages.length },
        source_video_path: sourceRow.output_video_path,
        credits_quoted: perOutputCost,
        status: "queued",
      })
      .select("id")
      .single();

    if (insertError || !row) {
      console.error("[generate-video/edit] Insert failed:", insertError);
      failures.push(insertError?.message ?? "Could not start edit");
      continue;
    }

    try {
      const { predictionId } = await submitVideoJob(model.replicateModel, replicateInput, webhookUrl);
      await supabase.from("video_generations").update({ replicate_prediction_id: predictionId }).eq("id", row.id);
      rowIds.push(row.id);
    } catch (submitError) {
      await supabase
        .from("video_generations")
        .update({ status: "failed", ...describeGenerationFailure("generate-video/edit", submitError) })
        .eq("id", row.id);
      failures.push(GENERIC_GENERATION_ERROR);
    }
  }

  if (rowIds.length === 0) {
    return NextResponse.json({ error: failures[0] ?? "Could not start edit" }, { status: 500 });
  }

  void recordUsageEvent("video", user.id, { mode: "edit", model: model.id, outputs: rowIds.length });

  return NextResponse.json({ ids: rowIds });
}

export const POST = withApiLogging("/api/generate-video/edit", handlePOST);
