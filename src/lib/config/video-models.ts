// Central catalog for the Video Generator's Create tab -- every Replicate
// video model this app exposes, plus the knobs each one actually accepts.
// This is the video equivalent of IMAGE_MODEL_MAP (cloudflare-image.ts) /
// MODEL_OPTIONS (ImageGenerator.tsx), and feeds replicate-video.ts's
// prediction client.
//
// Migrated off fal.ai (queue.fal.run) onto Replicate's predictions API --
// see replicate-video.ts's module header for why the async submit+webhook
// shape carries over unchanged even though the provider underneath is
// different. Unlike fal, no separate image-to-video model/slug is needed:
// every Replicate model below takes the start/end frame as just another
// input field on the SAME model, which simplifies this table considerably
// (no imageToVideoFalSlug, no DurationFormat variance -- Replicate's
// duration fields are plain integers across the board per the schemas
// checked).
//
// `replicateModel` values were confirmed to exist via Replicate's own
// text-to-video collection listing as of this writing. Their exact INPUT
// FIELD NAMES below (imageField, endFrameField, resolution handling) are
// BEST-EFFORT: Replicate's per-model schema pages render client-side and
// couldn't be scraped for a full OpenAPI schema from this environment (see
// replicate-image.ts's module header for the same caveat). Where a field
// name is explicitly noted as "confirmed" it was read directly off the
// model's own Replicate page; everything else is inferred from sibling
// models' conventions and needs live verification before the first real
// deploy -- same "don't trust, verify live" discipline this file always
// used for fal slugs, just not yet completed for the Replicate side. A
// wrong field name 422s loudly (with Replicate's real accepted-field list
// in the error body) rather than silently misbehaving.
//
// Note on catalog parity: the previous "Gemini Omni" tier (fal-ai's
// google/gemini-omni-flash) has NO confirmed Replicate equivalent -- Google
// doesn't appear to host a combined omni-modal video model there as of this
// writing -- so it was dropped rather than pointed at a guessed slug.

export type VideoModelTier = "budget" | "value" | "premium" | "flagship";

export interface VideoModelConfig {
  /** Display name -- also the value stored in video_generations.model and the dropdown key. */
  id: string;
  /** Replicate model slug, called via predictions.create({ model: replicateModel, ... }) -- see replicate-video.ts. */
  replicateModel: string;
  /** Field name for the start/first frame image. Defaults to "image" (Seedance-confirmed; assumed for others) if omitted. */
  imageField?: string;
  /** Field name for the end/last frame image. Defaults to "last_frame_image" (Seedance-confirmed) if omitted. Only used when supportsEndFrame is true. */
  endFrameField?: string;
  /**
   * How resolution maps onto this model's real input field. "direct" sends
   * the picked value straight through a `resolution` field (Seedance,
   * Grok Imagine -- both take literal "480p"/"720p"). "kling_mode" is
   * Kling's own confirmed shape: no `resolution` field at all, instead a
   * `mode: "standard"|"pro"` field where "standard"=720p, "pro"=1080p.
   */
  resolutionMode?: "direct" | "kling_mode";
  tier: VideoModelTier;
  description: string;
  logo?: string;
  supportsImageToVideo: boolean;
  /** First+last frame conditioning -- a subset of image-to-video models support this, not just a start frame. */
  supportsEndFrame: boolean;
  /** Model has a genuine native-audio track, not just silent video. */
  supportsAudio: boolean;
  durations: number[];
  aspectRatios: string[];
  /**
   * Resolution options exposed in the UI. First entry doubles as the
   * default in defaultSettingsFor (VideoGenerator.tsx). Undefined when the
   * model has no resolution control at all.
   */
  resolutions?: string[];
  /** ESTIMATED -- see pricing.ts's own disclosure convention. Correct against real Replicate invoices once live. */
  pricePerSecondUsd: number;
}

const GEMINI_ICON = "/logos/ai/gemini.svg";
const GROK_ICON = "/logos/ai/grok.svg";
const KLING_ICON = "/logos/ai/kling.svg";
const SEEDANCE_ICON = "/logos/ai/seedance.webp";

export const VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: "Veo 3 Fast",
    replicateModel: "google/veo-3.1-fast",
    tier: "premium",
    description: "Google Veo, native audio — faster & cheaper tier",
    logo: GEMINI_ICON,
    supportsImageToVideo: true,
    supportsEndFrame: true, // Veo 3.1's own description advertises "reference image and last frame support" -- field name unconfirmed, assumed "last_frame_image"
    supportsAudio: true,
    durations: [4, 6, 8],
    aspectRatios: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
    resolutionMode: "direct",
    pricePerSecondUsd: 0.25,
  },
  {
    id: "Veo 3 Quality",
    replicateModel: "google/veo-3.1",
    tier: "flagship",
    description: "Best for realism — native audio, premium quality",
    logo: GEMINI_ICON,
    supportsImageToVideo: true,
    supportsEndFrame: true,
    supportsAudio: true,
    durations: [4, 6, 8],
    aspectRatios: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
    resolutionMode: "direct",
    pricePerSecondUsd: 0.75,
  },
  {
    id: "Kling 3.0",
    replicateModel: "kwaivgi/kling-v3-video",
    // CONFIRMED (Replicate's own model page): mode: "standard"(720p)/"pro"(1080p),
    // duration: integer 3-15s, aspect_ratio (ignored once a start image is
    // given), generate_audio: boolean, negative_prompt, multi_prompt.
    // Start/end image field names are NOT confirmed -- guessed below.
    imageField: "start_image",
    tier: "premium",
    description: "Best for cinematic, animated shots",
    logo: KLING_ICON,
    supportsImageToVideo: true,
    supportsEndFrame: false, // no confirmed end-frame field for this model -- left off rather than guessed
    supportsAudio: true,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["720p", "1080p"],
    resolutionMode: "kling_mode",
    pricePerSecondUsd: 0.15,
  },
  {
    id: "Seedance 2",
    replicateModel: "bytedance/seedance-2.0-fast",
    // CONFIRMED (Replicate's own model page): prompt, duration (-1 = "intelligent duration"),
    // aspect_ratio (supports "adaptive"), resolution: 480p/720p, image (first frame),
    // last_frame_image (end frame), camera_fixed.
    imageField: "image",
    endFrameField: "last_frame_image",
    resolutionMode: "direct",
    tier: "premium",
    description: "Fast reference and asset generation",
    logo: SEEDANCE_ICON,
    supportsImageToVideo: true,
    supportsEndFrame: true,
    supportsAudio: true,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    resolutions: ["720p", "480p"],
    pricePerSecondUsd: 0.15,
  },
  {
    id: "Grok Imagine",
    replicateModel: "xai/grok-imagine-video",
    // Partially confirmed (Replicate's own model page): prompt (required),
    // duration 1-15s, aspect_ratio, resolution 480p/720p, image (i2v).
    // No confirmed audio-toggle field, so supportsAudio is left off even
    // though the model's description mentions native synchronized audio --
    // safer to not send an unconfirmed field than guess its name.
    imageField: "image",
    resolutionMode: "direct",
    tier: "premium",
    description: "xAI's video model — fast, expressive motion",
    logo: GROK_ICON,
    supportsImageToVideo: true,
    supportsEndFrame: false,
    supportsAudio: false,
    durations: [6],
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["720p", "480p"],
    pricePerSecondUsd: 0.2,
  },
];

export function getVideoModel(id: string): VideoModelConfig | undefined {
  return VIDEO_MODELS.find((model) => model.id === id);
}

export const DEFAULT_VIDEO_MODEL = "Veo 3 Fast";

// ── Edit tab operations ─────────────────────────────────────────────────
// These run against an existing video rather than picking from the Create
// catalog above, so they're modeled as fixed operations, each backed by one
// Replicate model. Slugs are TBD -- these were never live-verified even in
// the original fal.ai version of this table (see the prior git history),
// so this carries the same disclosure forward rather than regressing it:
// verify against Replicate's live catalog before wiring.

export interface VideoEditOperationConfig {
  id: "upscale" | "reframe" | "extend";
  label: string;
  description: string;
  replicateModel: string | null; // null for "extend", which reuses a Create model's i2v mode instead of a dedicated model
}

export const VIDEO_EDIT_OPERATIONS: VideoEditOperationConfig[] = [
  {
    id: "upscale",
    label: "Upscale",
    description: "Enhance resolution and clean up detail",
    replicateModel: "topaz-labs/video-upscale", // TBD, verify live
  },
  {
    id: "reframe",
    label: "Reframe",
    description: "Change aspect ratio with AI outpainting",
    replicateModel: "luma/reframe-video", // TBD, verify live
  },
  {
    id: "extend",
    label: "Extend",
    description: "Continue the video past its current ending",
    replicateModel: null,
  },
];

// ── Edit tab: prompt-based video editing ────────────────────────────────
// A model-choice operation (like Create's text_to_video/image_to_video),
// not a flat single-purpose op like upscale/reframe/extend above -- this is
// the competitor-parity "describe how you want to edit this video" flow:
// takes an existing generated video plus up to 4 reference images/elements
// and re-renders it with the requested change while keeping the source's
// motion/camera. kwaivgi/kling-o1 was confirmed to exist via Replicate's
// own Kling collection listing; its video-to-video-edit input field names
// (video_url/prompt/image_urls-equivalents) and the duration constraint are
// carried over from the pre-migration fal version as best-effort
// placeholders -- verify live before the first real deploy.
export interface PromptEditModelConfig {
  id: string;
  replicateModel: string;
  description: string;
  /** Source video duration bounds this editing flow accepts -- carried over from the fal version, unverified against Replicate's schema. */
  minSourceDurationSeconds: number;
  maxSourceDurationSeconds: number;
  maxReferenceImages: number;
  pricePerSecondUsd: number;
}

export const EDIT_VIDEO_MODELS: PromptEditModelConfig[] = [
  {
    id: "Kling O1 Edit",
    replicateModel: "kwaivgi/kling-o1",
    description: "Best quality — swap subjects, restyle scenes, keep the original motion",
    minSourceDurationSeconds: 3,
    maxSourceDurationSeconds: 10.05,
    maxReferenceImages: 4,
    pricePerSecondUsd: 0.168,
  },
];

export const DEFAULT_EDIT_VIDEO_MODEL = "Kling O1 Edit";

export function getEditVideoModel(id: string): PromptEditModelConfig | undefined {
  return EDIT_VIDEO_MODELS.find((model) => model.id === id);
}

// ── Motion tab ───────────────────────────────────────────────────────────
export interface MotionModelConfig {
  id: string;
  replicateModel: string; // TBD, verify live
  description: string;
}

export const MOTION_MODELS: MotionModelConfig[] = [
  {
    id: "Motion Transfer",
    replicateModel: "kwaivgi/kling-v2.5-turbo-pro", // TBD, verify live -- motion-control/puppeteer specific slug not confirmed
    description: "Drive a character image using a reference video's motion",
  },
];
