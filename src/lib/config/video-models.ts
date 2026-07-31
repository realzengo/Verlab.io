// Central catalog for the Video Generator's Create tab -- every fal.ai
// video model this app exposes, plus the knobs each one actually accepts.
// This is the video equivalent of IMAGE_MODEL_MAP (cloudflare-image.ts) /
// MODEL_OPTIONS (ImageGenerator.tsx), but for a fundamentally different
// provider shape: fal's video apps are queue-based (queue.fal.run), not the
// synchronous fal.run/{model} calls fal-image.ts makes, so this table feeds
// fal-video.ts's queue client instead.
//
// `falSlug` values are best-effort as of this writing and MUST be
// live-verified against fal.ai's model docs before the first real call --
// treat every entry the way fal-image.ts treats its own FAL_MODEL_SLUG map
// (comment there: "Live-confirmed... 200s once funded"). A wrong slug fails
// loudly (404 from fal), never silently.
//
// Note on catalog parity with competitor products: two names shown in
// typical competitor UIs -- "Sora 2" (OpenAI/ChatGPT-exclusive) and "Grok
// Imagine" (xAI-exclusive) -- are NOT available on fal.ai and are
// deliberately absent here. Adding them would mean direct OpenAI/xAI
// integration outside fal, a separate decision from this catalog.

export type VideoModelTier = "budget" | "value" | "premium" | "flagship";

export interface VideoModelConfig {
  /** Display name -- also the value stored in video_generations.model and the dropdown key. */
  id: string;
  /** fal app id, called as queue.fal.run/{falSlug} (see fal-video.ts). TBD entries need live verification. */
  falSlug: string;
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

export const VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: "LTX Video",
    falSlug: "fal-ai/ltx-video",
    tier: "budget",
    description: "Fastest & cheapest — great for drafts and iteration",
    supportsImageToVideo: true,
    supportsEndFrame: false,
    supportsAudio: false,
    durations: [5],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecondUsd: 0.02,
  },
  {
    id: "MiniMax Hailuo 2.3",
    falSlug: "fal-ai/minimax/hailuo-02",
    tier: "budget",
    description: "Cheap with strong, natural motion",
    supportsImageToVideo: true,
    supportsEndFrame: false,
    supportsAudio: false,
    durations: [6, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecondUsd: 0.03,
  },
  {
    id: "Wan 2.5",
    falSlug: "fal-ai/wan/v2.5/text-to-video",
    tier: "value",
    description: "Open-weight, well-rounded quality-to-cost ratio",
    supportsImageToVideo: true,
    supportsEndFrame: false,
    supportsAudio: false,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecondUsd: 0.04,
  },
  {
    id: "Kling 2.5 Turbo Pro",
    falSlug: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    tier: "value",
    description: "Recommended — fast, reliable, great default",
    supportsImageToVideo: true,
    supportsEndFrame: true,
    supportsAudio: false,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecondUsd: 0.07,
  },
  {
    id: "Seedance 1.0 Pro",
    falSlug: "fal-ai/bytedance/seedance/v1/pro/text-to-video",
    tier: "premium",
    description: "Fast reference and asset generation",
    supportsImageToVideo: true,
    supportsEndFrame: true,
    supportsAudio: false,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    pricePerSecondUsd: 0.12,
  },
  {
    id: "Kling 3.0",
    falSlug: "fal-ai/kling-video/v3/text-to-video",
    tier: "premium",
    description: "Best for cinematic, animated shots",
    supportsImageToVideo: true,
    supportsEndFrame: true,
    supportsAudio: false,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    pricePerSecondUsd: 0.15,
  },
  {
    id: "Veo 3.1 Fast",
    falSlug: "fal-ai/veo3.1/fast",
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
    id: "Veo 3.1",
    falSlug: "fal-ai/veo3.1",
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
];

// Mirrors the competitor UI's Popular/More grouping in the model picker.
export const POPULAR_VIDEO_MODEL_IDS = ["Kling 2.5 Turbo Pro", "Veo 3.1 Fast", "Seedance 1.0 Pro", "Wan 2.5"];

export function getVideoModel(id: string): VideoModelConfig | undefined {
  return VIDEO_MODELS.find((model) => model.id === id);
}

export const DEFAULT_VIDEO_MODEL = "Kling 2.5 Turbo Pro";

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
