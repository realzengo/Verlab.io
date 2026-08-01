// Central catalog for the Video Generator's Create tab -- every fal.ai
// video model this app exposes, plus the knobs each one actually accepts.
// This is the video equivalent of IMAGE_MODEL_MAP (cloudflare-image.ts) /
// MODEL_OPTIONS (ImageGenerator.tsx), but for a fundamentally different
// provider shape: fal's video apps are queue-based (queue.fal.run), not the
// synchronous fal.run/{model} calls fal-image.ts makes, so this table feeds
// fal-video.ts's queue client instead.
//
// `falSlug` values below are live-verified (see the comment directly above
// VIDEO_MODELS for how) rather than best-effort guesses -- treat any future
// addition to this table the way fal-image.ts treats its own FAL_MODEL_SLUG
// map (comment there: "Live-confirmed... 200s once funded"). A wrong slug
// fails loudly (404 from fal), never silently.
//
// Note on catalog parity with competitor products: "Sora 2" (OpenAI/
// ChatGPT-exclusive) is NOT available on fal.ai and is deliberately absent
// here.

export type VideoModelTier = "budget" | "value" | "premium" | "flagship";

// How each fal app wants `duration` on the wire -- confirmed per model
// against fal's public queue OpenAPI schema (https://fal.ai/api/openapi/
// queue/openapi.json?endpoint_id={falSlug}), not guessed:
//   "suffix_s" -- string with a trailing "s", e.g. "8s" (Veo 3 family).
//   "plain_string" -- string of the bare integer, e.g. "5" (Kling, Seedance).
//   "integer" -- a JSON number, e.g. 6 (Grok Imagine, Gemini Omni).
// Sending the wrong shape either 422s or (worse) gets silently coerced/
// ignored depending on the model's pydantic schema, so this must stay
// correct per model rather than assuming one shape fits all fal apps.
export type DurationFormat = "suffix_s" | "plain_string" | "integer";

export interface VideoModelConfig {
  /** Display name -- also the value stored in video_generations.model and the dropdown key. */
  id: string;
  /** fal app id for the text-to-video call, called as queue.fal.run/{falSlug} (see fal-video.ts). Live-verified via fal's queue OpenAPI schema as of this writing. */
  falSlug: string;
  // Every fal video app that accepts a start/end frame ships it as a
  // *separate* queue endpoint from the plain text-to-video one (different
  // required fields, sometimes a different pydantic model entirely) -- there
  // is no single endpoint that does both. Only present when
  // supportsImageToVideo is true; buildFalCreateInput (generate-video/
  // route.ts) submits here instead of `falSlug` whenever a start frame is
  // given.
  imageToVideoFalSlug?: string;
  // Request-body field name each i2v endpoint uses for the start frame --
  // NOT uniform across providers (Kling wants start_image_url, Seedance/Veo/
  // Grok want image_url). Defaults to "image_url" when supportsImageToVideo
  // is true and this is omitted.
  startFrameField?: string;
  // Same idea for the end/tail frame, only meaningful when supportsEndFrame
  // is true. Every model that supports it uses "end_image_url" (confirmed
  // via fal's OpenAPI schema), so this only exists as an escape hatch.
  endFrameField?: string;
  durationFormat: DurationFormat;
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
  /** ESTIMATED -- see pricing.ts's own disclosure convention. Correct against real fal invoices once live. */
  pricePerSecondUsd: number;
}

const GEMINI_ICON = "/logos/ai/gemini.svg";

// Every falSlug + durationFormat + aspectRatios/durations pairing below was
// checked against fal's live queue OpenAPI schema
// (https://fal.ai/api/openapi/queue/openapi.json?endpoint_id={falSlug}) and,
// separately, a real POST to https://queue.fal.run/{falSlug} with an empty
// body -- fal validates on dequeue rather than at submit time, so this
// returns HTTP 200/IN_QUEUE immediately and the job settles (COMPLETED, with
// an error body) in well under a second, before any real render starts.
// Confirmed a 422 "prompt: Field required" for all 6, proving the slug is
// real and reachable, at effectively zero cost. Tier picked for Kling
// 3.0/Seedance 2 is the cheaper of the two (standard/fast) since neither
// name in the source screenshot specified a quality tier.
//
// imageToVideoFalSlug entries were checked the same way against each
// provider's own image-to-video schema: Veo 3 (both tiers), Kling 3.0,
// Seedance 2, and Grok Imagine all expose one; Gemini Omni's schema has no
// image field at all (text prompt only), so it stays text-to-video-only.
export const VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: "Veo 3 Fast",
    falSlug: "fal-ai/veo3/fast",
    imageToVideoFalSlug: "fal-ai/veo3/fast/image-to-video",
    durationFormat: "suffix_s",
    tier: "premium",
    description: "Google Veo, native audio — faster & cheaper tier",
    logo: GEMINI_ICON,
    supportsImageToVideo: true,
    supportsEndFrame: false,
    supportsAudio: true,
    durations: [8],
    aspectRatios: ["16:9", "9:16"],
    pricePerSecondUsd: 0.25,
  },
  {
    id: "Veo 3 Quality",
    falSlug: "fal-ai/veo3",
    imageToVideoFalSlug: "fal-ai/veo3/image-to-video",
    durationFormat: "suffix_s",
    tier: "flagship",
    description: "Best for realism — native audio, premium quality",
    logo: GEMINI_ICON,
    supportsImageToVideo: true,
    supportsEndFrame: false,
    supportsAudio: true,
    durations: [8],
    aspectRatios: ["16:9", "9:16"],
    pricePerSecondUsd: 0.75,
  },
  {
    id: "Kling 3.0",
    falSlug: "fal-ai/kling-video/v3/standard/text-to-video",
    imageToVideoFalSlug: "fal-ai/kling-video/v3/standard/image-to-video",
    startFrameField: "start_image_url",
    durationFormat: "plain_string",
    tier: "premium",
    description: "Best for cinematic, animated shots",
    supportsImageToVideo: true,
    supportsEndFrame: true,
    supportsAudio: true,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecondUsd: 0.15,
  },
  {
    id: "Seedance 2",
    falSlug: "bytedance/seedance-2.0/fast/text-to-video",
    imageToVideoFalSlug: "bytedance/seedance-2.0/fast/image-to-video",
    durationFormat: "plain_string",
    tier: "premium",
    description: "Fast reference and asset generation",
    supportsImageToVideo: true,
    supportsEndFrame: true,
    supportsAudio: true,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    pricePerSecondUsd: 0.15,
  },
  {
    id: "Grok Imagine",
    falSlug: "xai/grok-imagine-video/text-to-video",
    imageToVideoFalSlug: "xai/grok-imagine-video/image-to-video",
    durationFormat: "integer",
    tier: "premium",
    description: "xAI's video model — fast, expressive motion",
    supportsImageToVideo: true,
    supportsEndFrame: false,
    supportsAudio: false,
    durations: [6],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecondUsd: 0.2,
  },
  {
    id: "Gemini Omni",
    falSlug: "google/gemini-omni-flash",
    durationFormat: "integer",
    tier: "flagship",
    description: "Google Gemini — omni-modal generation",
    logo: GEMINI_ICON,
    // Schema checked directly (see module header) -- no image_url or
    // equivalent field exists on this app at all, so unlike the other 5
    // models this one genuinely has no image-to-video path to wire up.
    supportsImageToVideo: false,
    supportsEndFrame: false,
    // No generate_audio (or any audio) param in this app's schema -- unlike
    // the Veo/Kling/Seedance apps above, audio isn't a togglable input here.
    supportsAudio: false,
    durations: [8],
    aspectRatios: ["16:9", "9:16"],
    pricePerSecondUsd: 0.5,
  },
];

export function getVideoModel(id: string): VideoModelConfig | undefined {
  return VIDEO_MODELS.find((model) => model.id === id);
}

export const DEFAULT_VIDEO_MODEL = "Veo 3 Fast";

// ── Edit tab operations ─────────────────────────────────────────────────
// These run against an existing video rather than picking from the Create
// catalog above, so they're modeled as fixed operations, each backed by one
// fal app. Slugs are TBD -- verify against fal's live video-editing catalog
// before wiring (see the module header note on live-verification).

export interface VideoEditOperationConfig {
  id: "upscale" | "reframe" | "extend";
  label: string;
  description: string;
  falSlug: string | null; // null for "extend", which reuses a Create model's i2v mode instead of a dedicated fal app
}

export const VIDEO_EDIT_OPERATIONS: VideoEditOperationConfig[] = [
  {
    id: "upscale",
    label: "Upscale",
    description: "Enhance resolution and clean up detail",
    falSlug: "fal-ai/topaz/upscale/video", // TBD, verify live
  },
  {
    id: "reframe",
    label: "Reframe",
    description: "Change aspect ratio with AI outpainting",
    falSlug: "fal-ai/luma-dream-machine/reframe", // TBD, verify live
  },
  {
    id: "extend",
    label: "Extend",
    description: "Continue the video past its current ending",
    falSlug: null,
  },
];

// ── Edit tab: prompt-based video editing ────────────────────────────────
// A model-choice operation (like Create's text_to_video/image_to_video),
// not a flat single-purpose op like upscale/reframe/extend above -- this is
// the competitor-parity "describe how you want to edit this video" flow:
// takes an existing generated video as @Video1 plus up to 4 reference
// images/elements addressed as @Image1.."@Image4 in the prompt, and
// re-renders it with the requested change while keeping the source's
// motion/camera. Slugs, param names (video_url/prompt/image_urls), the
// duration constraint (source clip must be 3-10.05s), and pricing are from
// fal's public model docs as of this writing (fal.ai/models/fal-ai/
// kling-video/o1/{,standard/}video-to-video/edit) -- confirm live before
// the first real call, same discipline as every other falSlug in this file.
export interface PromptEditModelConfig {
  id: string;
  falSlug: string;
  description: string;
  /** fal rejects source videos shorter/longer than this -- enforced client + server side before submit. */
  minSourceDurationSeconds: number;
  maxSourceDurationSeconds: number;
  maxReferenceImages: number;
  pricePerSecondUsd: number;
}

export const EDIT_VIDEO_MODELS: PromptEditModelConfig[] = [
  {
    id: "Kling O1 Edit",
    falSlug: "fal-ai/kling-video/o1/video-to-video/edit",
    description: "Best quality — swap subjects, restyle scenes, keep the original motion",
    minSourceDurationSeconds: 3,
    maxSourceDurationSeconds: 10.05,
    maxReferenceImages: 4,
    pricePerSecondUsd: 0.168,
  },
  {
    id: "Kling O1 Edit (Standard)",
    falSlug: "fal-ai/kling-video/o1/standard/video-to-video/edit",
    description: "Faster and cheaper — same editing flow, lighter tier",
    minSourceDurationSeconds: 3,
    maxSourceDurationSeconds: 10.05,
    maxReferenceImages: 4,
    pricePerSecondUsd: 0.126,
  },
];

export const DEFAULT_EDIT_VIDEO_MODEL = "Kling O1 Edit";

export function getEditVideoModel(id: string): PromptEditModelConfig | undefined {
  return EDIT_VIDEO_MODELS.find((model) => model.id === id);
}

// ── Motion tab ───────────────────────────────────────────────────────────
export interface MotionModelConfig {
  id: string;
  falSlug: string; // TBD, verify live
  description: string;
}

export const MOTION_MODELS: MotionModelConfig[] = [
  {
    id: "Motion Transfer",
    falSlug: "fal-ai/kling-video/motion-control", // TBD, verify live
    description: "Drive a character image using a reference video's motion",
  },
];
