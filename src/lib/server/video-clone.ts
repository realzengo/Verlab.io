// Provider inputs for every Clone tool/model pairing (see CLONE_MODES in
// video-models.ts), plus the one multi-stage handoff some of them need. A
// Clone row's params.cloneStage says which prediction
// replicate_prediction_id points at:
//
//   "video" -- the render itself. Most jobs are submitted straight into this
//              stage by /api/generate-video/clone (buildCloneSubmission).
//   "frame" -- Kling Motion Control jobs that need a new still first (Motion
//              transfer, or Character with Match background -- see
//              cloneNeedsFrameStage): Nano Banana Pro rebuilds the clip's
//              opening frame, then advanceCloneToVideoStage animates it.
//
// advanceVideoJob (video-jobs.ts) owns status checks for both stages and the
// final store/charge, so the webhook, cron sweep and dev-mode GET reconcile
// all chain the stages the same way.
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CLONE_FRAME_MODEL,
  cloneNeedsFrameStage,
  getCloneMode,
  type CloneModeConfig,
  type CloneResolution,
  type CloneToolId,
} from "@/lib/config/video-models";
import { submitVideoJob, downloadVideoAsset } from "./replicate-video";
import { describeGenerationFailure } from "./generation-error";

type AdminClient = ReturnType<typeof createAdminClient>;

export type CloneStage = "frame" | "video";

export interface CloneJobParams {
  tool: CloneToolId;
  cloneStage: CloneStage;
  sourceGenerationId: string;
  durationSeconds: number;
  resolution: CloneResolution;
  aspectRatio?: string;
  referenceImageCount: number;
  /** Character only. */
  keepOriginalSound?: boolean;
  /** Character only. */
  matchBackground?: boolean;
}

/** Everything any engine might need to build its request. */
export interface CloneJobContext {
  prompt: string | null;
  videoUrl: string;
  referenceImages: string[];
  resolution: CloneResolution;
  durationSeconds: number;
  aspectRatio?: string;
  keepOriginalSound: boolean;
  matchBackground: boolean;
  /** The clip's first frame (captured client-side) -- only for jobs with a frame pre-pass. */
  frameImage: string | null;
}

const STORAGE_BUCKET = "videos";
// Providers fetch inputs when the prediction starts, which can sit behind a
// queue -- an hour leaves plenty of slack without minting a near-permanent URL.
export const CLONE_INPUT_URL_TTL_SECONDS = 60 * 60;
// Seedance 2.5's literal aspect_ratio values that this app's tiles also use.
const SEEDANCE_ASPECT_RATIOS = new Set(["16:9", "9:16", "1:1", "4:3", "3:4"]);

const MENTION_PATTERN = /@Image(\d+)/g;

/** Rewrites the prompt box's @ImageN chips into one engine's own reference syntax (numbering is unchanged). */
function rewriteMentions(text: string | null, format: (n: number) => string): string | null {
  const trimmed = text?.trim();
  return trimmed ? trimmed.replace(MENTION_PATTERN, (_, n: string) => format(Number(n))) : null;
}

/** "@image_1", "@image_1 and @image_2", "@image_1, @image_2 and @image_3" -- named one by one, since engines match references by name. */
function listOf(count: number, format: (n: number) => string): string {
  const names = Array.from({ length: count }, (_, i) => format(i + 1));
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function clampDuration(mode: CloneModeConfig, seconds: number): number {
  return Math.min(Math.floor(mode.maxSourceDurationSeconds), Math.max(Math.ceil(mode.minSourceDurationSeconds), Math.round(seconds)));
}

/** Snaps the source's ratio hint to the 16:9 / 9:16 / 1:1 set Kling renders. */
function klingAspectRatio(hint: string | undefined): string | undefined {
  const [w, h] = (hint ?? "").split(":").map(Number);
  if (!w || !h) return undefined;
  if (w === h) return "1:1";
  return w > h ? "16:9" : "9:16";
}

function resolutionValue(mode: CloneModeConfig, resolution: CloneResolution): string {
  return mode.resolutionValues?.[resolution] ?? resolution;
}

/**
 * The shared instruction wording, in each engine's own reference syntax --
 * an edit keeps everything not named; a motion reference keeps only motion.
 *
 * Object swap's wording was tuned live on Kling 4.0 with a face swap over a
 * fast-cut montage. The first version ("use the images for what to swap in,
 * matching their faces, outfits and details") changed the face in only some
 * shots, drifted off the source after a few cuts, and fought prompts like
 * "keep his suit" by asking for the reference's outfit. Saying what the
 * images are for, asking for the change in every shot, and listing clothing
 * among what stays put the new face in every shot and kept the edit intact.
 */
function buildClonePrompt(
  tool: CloneToolId,
  userPrompt: string | null,
  referenceCount: number,
  syntax: { video: string; image: (n: number) => string }
): string {
  const scene = rewriteMentions(userPrompt, syntax.image);
  const refs = listOf(referenceCount, syntax.image);
  const lines: string[] = [];

  if (tool === "object_swap") {
    if (scene) lines.push(`Edit ${syntax.video}: ${scene}`);
    if (referenceCount > 0) {
      lines.push(
        `${refs} ${referenceCount === 1 ? "shows" : "show"} exactly what to put in. For a person, reproduce their face, hair, skin tone and facial hair faithfully so they are clearly recognisable; for an object, its exact shape, colours and details.`
      );
    }
    lines.push(
      `Apply the change in every shot and every frame of ${syntax.video}, including after each cut.`,
      "Change only what is named. Keep everything else exactly as filmed: the same shots, cuts, motion, expressions, camera movement, timing, clothing, background and lighting."
    );
  } else {
    if (scene) lines.push(`New scene: ${scene}`);
    lines.push(
      `Use ${syntax.video} only as a motion reference: reproduce its exact body movement, choreography, gestures, timing and camera movement.`,
      `The people and the place are new. Do not reuse anyone's appearance, clothing or the setting from ${syntax.video}.`
    );
    if (referenceCount > 0) {
      lines.push(`Build the new people, outfits, products and places from ${refs}. For a person, reproduce their face, hair and outfit faithfully so they are clearly recognisable.`);
    }
  }

  return lines.join("\n");
}

/** Kling 4.0: the clip is base_video for an edit, or a reference video whose motion is borrowed. */
export function buildKling4Input(mode: CloneModeConfig, ctx: CloneJobContext): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: buildClonePrompt(mode.tool, ctx.prompt, ctx.referenceImages.length, { video: "@video_1", image: (n) => `@image_${n}` }),
    resolution: resolutionValue(mode, ctx.resolution),
  };
  if (mode.tool === "object_swap") {
    // An edit keeps the base video's own length and aspect ratio, so neither is sent.
    input.base_video = ctx.videoUrl;
  } else {
    input.reference_videos = [ctx.videoUrl];
    input.duration = clampDuration(mode, ctx.durationSeconds);
    const aspectRatio = klingAspectRatio(ctx.aspectRatio);
    if (aspectRatio) input.aspect_ratio = aspectRatio;
  }
  if (ctx.referenceImages.length > 0) input.reference_images = ctx.referenceImages;
  return input;
}

/** Kling O1 / 3.0 Omni: "base" edits the clip itself, "feature" borrows its motion and camera. */
export function buildKlingOmniInput(mode: CloneModeConfig, ctx: CloneJobContext): Record<string, unknown> {
  const isEdit = mode.tool === "object_swap";
  const input: Record<string, unknown> = {
    prompt: buildClonePrompt(mode.tool, ctx.prompt, ctx.referenceImages.length, { video: "<<<video_1>>>", image: (n) => `<<<image_${n}>>>` }),
    reference_video: ctx.videoUrl,
    video_reference_type: isEdit ? "base" : "feature",
  };
  if (!isEdit) {
    input.duration = clampDuration(mode, ctx.durationSeconds);
    // Only an edit inherits the clip's framing; a fresh render defaults to 16:9.
    const aspectRatio = klingAspectRatio(ctx.aspectRatio);
    if (aspectRatio) input.aspect_ratio = aspectRatio;
  }
  if (mode.resolutionInput === "mode") input.mode = resolutionValue(mode, ctx.resolution);
  if (ctx.referenceImages.length > 0) input.reference_images = ctx.referenceImages;
  return input;
}

/** Seedance 2.5: edits infer length/framing from the clip (-1 + adaptive); a motion reference renders a fresh clip. */
export function buildSeedanceInput(mode: CloneModeConfig, ctx: CloneJobContext): Record<string, unknown> {
  const isEdit = mode.tool === "object_swap";
  const input: Record<string, unknown> = {
    prompt: buildClonePrompt(mode.tool, ctx.prompt, ctx.referenceImages.length, { video: "[Video1]", image: (n) => `[Image${n}]` }),
    reference_videos: [ctx.videoUrl],
    resolution: resolutionValue(mode, ctx.resolution),
    generate_audio: true,
    duration: isEdit ? -1 : clampDuration(mode, ctx.durationSeconds),
    aspect_ratio: !isEdit && ctx.aspectRatio && SEEDANCE_ASPECT_RATIOS.has(ctx.aspectRatio) ? ctx.aspectRatio : "adaptive",
  };
  if (ctx.referenceImages.length > 0) input.reference_images = ctx.referenceImages;
  return input;
}

/** Gemini Omni video edit -- plain-language references, no mention syntax. */
export function buildGeminiOmniInput(mode: CloneModeConfig, ctx: CloneJobContext): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: buildClonePrompt(mode.tool, ctx.prompt, ctx.referenceImages.length, { video: "this video", image: (n) => `reference image ${n}` }),
    video: ctx.videoUrl,
  };
  if (ctx.referenceImages.length > 0) input.reference_images = ctx.referenceImages;
  return input;
}

/** Kling Motion Control: a still (character photo or rebuilt frame) performs the clip's moves. */
export function buildKlingInput(
  mode: CloneModeConfig,
  params: { imageUrl: string; videoUrl: string; resolution: CloneResolution; prompt: string | null; keepOriginalSound: boolean }
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    image: params.imageUrl,
    video: params.videoUrl,
    // "video" follows the source clip's framing and allows up to 30s
    // ("image" would cap output at 10s and reframe to the still).
    character_orientation: "video",
    mode: resolutionValue(mode, params.resolution),
    keep_original_sound: params.keepOriginalSound,
  };
  // There's only ever one photo, so an @Image1 chip just means "the character".
  const prompt = rewriteMentions(params.prompt, () => "the character");
  if (prompt) input.prompt = prompt;
  return input;
}

/** Wan 2.2 Animate: the replace variant keeps the clip's scene (Match background); animation animates the photo. */
export function buildWanAnimateInput(mode: CloneModeConfig, ctx: CloneJobContext): Record<string, unknown> {
  return {
    video: ctx.videoUrl,
    character_image: ctx.referenceImages[0],
    resolution: resolutionValue(mode, ctx.resolution),
    merge_audio: ctx.keepOriginalSound,
  };
}

/** P-Video Replace: swaps the clip's performer for the photo; the clip supplies scene, motion and sound. */
export function buildPrunaReplaceInput(mode: CloneModeConfig, ctx: CloneJobContext): Record<string, unknown> {
  const input: Record<string, unknown> = {
    video: ctx.videoUrl,
    images: ctx.referenceImages,
    resolution: resolutionValue(mode, ctx.resolution),
    save_audio: ctx.keepOriginalSound,
  };
  const prompt = rewriteMentions(ctx.prompt, () => "the character");
  if (prompt) input.instruction_prompt = prompt;
  return input;
}

const CHARACTER_FRAME_PROMPT = [
  "Image 1 is a frame from a video. Image 2 is a photo of a character.",
  "Recreate Image 1 exactly -- same camera angle, framing, background, props and lighting -- but replace the main person with the character from Image 2, reproducing their face, hair, body and outfit faithfully.",
  "The character must hold the exact pose, body position, hand placement and facial expression of the person they replace.",
  "Change nothing else. Photorealistic unless the character is illustrated, no added text, captions, borders or watermarks.",
].join("\n\n");

/** Motion transfer's still: same pose and composition as the clip's first frame, but new people and place. */
function buildMotionTransferFramePrompt(userPrompt: string | null, referenceCount: number): string {
  const lines = [
    "Image 1 is a frame from a video. Create a new image as the first frame of a new shot that keeps Image 1's exact camera angle, framing and composition, and every person's exact pose, body position, hand placement and facial expression.",
    "The people and the place are new: do not reuse anyone's appearance, clothing or the setting from Image 1.",
  ];
  if (referenceCount > 0) {
    const refs = referenceCount === 1 ? "Image 2" : `Images 2-${referenceCount + 1}`;
    lines.push(`Build the new people, outfits, products and places from ${refs}, reproducing their identity, faces and details faithfully.`);
  }
  // The frame is Image 1 here, so the prompt box's @ImageN shifts up by one.
  const scene = rewriteMentions(userPrompt, (n) => `Image ${n + 1}`);
  if (scene) lines.push(`New scene: ${scene}`);
  lines.push("Photorealistic unless the references are illustrated, no added text, captions, borders or watermarks.");
  return lines.join("\n\n");
}

function buildFrameInput(mode: CloneModeConfig, ctx: CloneJobContext & { frameImage: string }): Record<string, unknown> {
  const isCharacter = mode.tool === "character";
  return {
    prompt: isCharacter ? CHARACTER_FRAME_PROMPT : buildMotionTransferFramePrompt(ctx.prompt, ctx.referenceImages.length),
    image_input: [ctx.frameImage, ...ctx.referenceImages],
    aspect_ratio: "match_input_image",
    resolution: CLONE_FRAME_MODEL.frameResolutions[ctx.resolution],
    output_format: "jpg",
  };
}

/**
 * The first prediction a Clone job submits: the frame pre-pass when the
 * model needs one, otherwise the render itself, in that engine's shape.
 */
export function buildCloneSubmission(mode: CloneModeConfig, ctx: CloneJobContext): { replicateModel: string; input: Record<string, unknown>; stage: CloneStage } {
  if (cloneNeedsFrameStage(mode, ctx.matchBackground)) {
    if (!ctx.frameImage) throw new Error("frameImage is required for this model");
    return { replicateModel: CLONE_FRAME_MODEL.replicateModel, input: buildFrameInput(mode, { ...ctx, frameImage: ctx.frameImage }), stage: "frame" };
  }

  switch (mode.engine) {
    case "kling4":
      return { replicateModel: mode.replicateModel, input: buildKling4Input(mode, ctx), stage: "video" };
    case "kling_omni":
      return { replicateModel: mode.replicateModel, input: buildKlingOmniInput(mode, ctx), stage: "video" };
    case "seedance":
      return { replicateModel: mode.replicateModel, input: buildSeedanceInput(mode, ctx), stage: "video" };
    case "gemini_omni":
      return { replicateModel: mode.replicateModel, input: buildGeminiOmniInput(mode, ctx), stage: "video" };
    case "pruna_replace":
      return { replicateModel: mode.replicateModel, input: buildPrunaReplaceInput(mode, ctx), stage: "video" };
    case "wan_animate":
      return {
        replicateModel: ctx.matchBackground ? (mode.matchBackgroundReplicateModel ?? mode.replicateModel) : mode.replicateModel,
        input: buildWanAnimateInput(mode, ctx),
        stage: "video",
      };
    case "kling_motion":
      return {
        replicateModel: mode.replicateModel,
        input: buildKlingInput(mode, {
          imageUrl: ctx.referenceImages[0],
          videoUrl: ctx.videoUrl,
          resolution: ctx.resolution,
          prompt: ctx.prompt,
          keepOriginalSound: ctx.keepOriginalSound,
        }),
        stage: "video",
      };
  }
}

/**
 * Frame stage succeeded: store the frame (it doubles as the job's
 * thumbnail), then submit the Kling job and repoint the row at it.
 *
 * Claims the handoff first by clearing replicate_prediction_id while it
 * still matches the frame prediction -- the webhook and cron sweep race for
 * the same job, and only the caller whose UPDATE matched goes on to submit,
 * so a frame is never animated twice. A crash after the claim leaves the row
 * with no prediction id, which the stale-job sweep then fails (unbilled).
 */
export async function advanceCloneToVideoStage(
  row: { id: string; user_id: string; model: string; replicate_prediction_id: string },
  frameOutputUrl: string,
  admin: AdminClient,
  webhookUrl?: string
): Promise<void> {
  const { data: claimed } = await admin
    .from("video_generations")
    .update({ replicate_prediction_id: null, status: "processing" })
    .eq("id", row.id)
    .eq("replicate_prediction_id", row.replicate_prediction_id)
    .select("params, source_video_path, prompt")
    .maybeSingle<{ params: CloneJobParams; source_video_path: string | null; prompt: string | null }>();

  if (!claimed) return;

  try {
    const mode = getCloneMode(row.model);
    if (!mode || mode.engine !== "kling_motion") throw new Error(`Clone mode "${row.model}" has no frame stage`);
    if (!claimed.source_video_path) throw new Error("Clone job has no source video");

    const frame = await downloadVideoAsset(frameOutputUrl, 60_000);
    const isPng = frame.contentType === "image/png";
    const framePath = `${row.user_id}/${row.id}/frame.${isPng ? "png" : "jpg"}`;
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(framePath, frame.bytes, { contentType: isPng ? "image/png" : "image/jpeg", upsert: true });
    if (uploadError) throw new Error(`Frame storage upload failed: ${uploadError.message}`);

    // Recorded before anything else can fail so the frame is never orphaned
    // -- the library DELETE route removes thumbnail_path along with the row.
    await admin.from("video_generations").update({ thumbnail_path: framePath }).eq("id", row.id);

    const [{ data: signedFrame, error: frameSignError }, { data: signedSource, error: sourceSignError }] = await Promise.all([
      admin.storage.from(STORAGE_BUCKET).createSignedUrl(framePath, CLONE_INPUT_URL_TTL_SECONDS),
      admin.storage.from(STORAGE_BUCKET).createSignedUrl(claimed.source_video_path, CLONE_INPUT_URL_TTL_SECONDS),
    ]);
    if (frameSignError || !signedFrame) throw new Error(`Could not sign frame URL: ${frameSignError?.message}`);
    if (sourceSignError || !signedSource) throw new Error(`Could not sign source video URL: ${sourceSignError?.message}`);

    const { predictionId } = await submitVideoJob(
      mode.replicateModel,
      buildKlingInput(mode, {
        imageUrl: signedFrame.signedUrl,
        videoUrl: signedSource.signedUrl,
        resolution: claimed.params.resolution,
        // Motion transfer's scene description already shaped the frame;
        // Character's prompt (scene, clothing, camera) goes to Kling itself.
        prompt: mode.tool === "character" ? claimed.prompt : null,
        keepOriginalSound: claimed.params.keepOriginalSound ?? true,
      }),
      webhookUrl
    );

    const { error: updateError } = await admin
      .from("video_generations")
      .update({ replicate_prediction_id: predictionId, replicate_model: mode.replicateModel, params: { ...claimed.params, cloneStage: "video" } })
      .eq("id", row.id);
    if (updateError) throw new Error(`Failed to record clone video prediction: ${updateError.message}`);
  } catch (error) {
    await admin
      .from("video_generations")
      .update({ status: "failed", ...describeGenerationFailure("video-clone", error) })
      .eq("id", row.id);
  }
}
