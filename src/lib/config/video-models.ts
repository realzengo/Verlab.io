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
  /** Only selectable on the Pro (or higher) plan -- shown to everyone in the picker, but locked with an upgrade prompt for Core users. */
  requiresPro?: boolean;
  /** Only selectable on the Scale plan -- stricter than requiresPro, locked for Core AND Pro users. */
  requiresScale?: boolean;
  logo?: string;
  /** Logo is already a filled square/circular app icon (own background) -- render full-bleed rather than as a small centered glyph. */
  logoFullBleed?: boolean;
  supportsImageToVideo: boolean;
  /** First+last frame conditioning -- a subset of image-to-video models support this, not just a start frame. */
  supportsEndFrame: boolean;
  /**
   * Style/subject reference images (the "+ References" control) -- a
   * separate input from start/end frame conditioning above: these guide
   * likeness/style rather than pin down the first or last rendered frame.
   * Field name is BEST-EFFORT/unverified per the module header's usual
   * caveat -- a wrong name 422s loudly with Replicate's accepted-field list
   * rather than silently misbehaving.
   */
  supportsReferenceImages?: boolean;
  /** Field name for the reference-images array. Defaults to "reference_images" if omitted. */
  referenceImagesField?: string;
  /** Max attachable reference images. Defaults to 4 (matches EDIT_VIDEO_MODELS' maxReferenceImages convention) if omitted. */
  maxReferenceImages?: number;
  /** Model has a genuine native-audio track, not just silent video. */
  supportsAudio: boolean;
  durations: number[];
  aspectRatios: string[];
  /**
   * Overrides the literal value sent for `aspect_ratio` when a model's own
   * Replicate schema doesn't use the "16:9"/"9:16" labels shown in the UI --
   * confirmed live for Sora 2, which 422s on the ratio strings and wants
   * "landscape"/"portrait" instead. Keyed by the aspectRatios label; falls
   * back to sending that label as-is when a model has no entry here.
   */
  aspectRatioValues?: Record<string, string>;
  /**
   * Resolution options exposed in the UI. First entry doubles as the
   * default in defaultSettingsFor (VideoGenerator.tsx). Undefined when the
   * model has no resolution control at all.
   */
  resolutions?: string[];
  /** ESTIMATED -- see pricing.ts's own disclosure convention. Correct against real Replicate invoices once live. */
  pricePerSecondUsd: number;
  /**
   * Hard cap on `prompt`'s length, when the model's own schema enforces one
   * -- generate-video/route.ts rejects an over-length prompt with a clear
   * 400 before ever calling Replicate. Omit when no limit is confirmed
   * rather than guessing one; sending an unconfirmed-but-too-long prompt
   * still fails, just via Replicate's own 422 (see submitVideoJob's error
   * surfacing) instead of this earlier, friendlier check.
   */
  maxPromptLength?: number;
}

const GEMINI_ICON = "/logos/ai/gemini.svg";
const GROK_ICON = "/logos/ai/grok.svg";
const KLING_ICON = "/logos/ai/kling.svg";
const SEEDANCE_ICON = "/logos/ai/seedance.webp";
const SORA_ICON = "/logos/ai/sora.svg";

export const VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: "Veo 3 Fast",
    replicateModel: "google/veo-3.1-fast",
    tier: "premium",
    description: "Google Veo, native audio, faster & cheaper tier",
    logo: GEMINI_ICON,
    supportsImageToVideo: true,
    supportsReferenceImages: true,
    supportsEndFrame: true, // Veo 3.1's own description advertises "reference image and last frame support" -- field name unconfirmed, assumed "last_frame_image"
    supportsAudio: true,
    durations: [4, 6, 8],
    aspectRatios: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
    resolutionMode: "direct",
    // CONFIRMED (Replicate's own billingConfig, embedded in the model page's
    // Next.js data -- not visible in the rendered HTML/markdown, only the raw
    // response): with_audio $0.15/s, without_audio $0.10/s, no separate
    // resolution tiers. Priced for the with-audio worst case (this app lets
    // the user toggle sound off per soundEnabled in VideoGenerator.tsx, but
    // getVideoGenerationCost doesn't vary by audio, so the higher tier is the
    // safe baseline -- same worst-case convention pricing.ts uses elsewhere).
    // The old 0.25 here was an unsourced placeholder that priced this
    // "faster & cheaper" tier above several flagship models.
    pricePerSecondUsd: 0.15,
  },
  {
    id: "Veo 3 Quality",
    replicateModel: "google/veo-3.1",
    tier: "flagship",
    description: "Best for realism, native audio, premium quality",
    logo: GEMINI_ICON,
    supportsImageToVideo: true,
    supportsReferenceImages: true,
    supportsEndFrame: true,
    supportsAudio: true,
    durations: [4, 6, 8],
    aspectRatios: ["16:9", "9:16"],
    resolutions: ["720p", "1080p"],
    resolutionMode: "direct",
    // CONFIRMED (Replicate's own billingConfig, same source/caveat as Veo 3
    // Fast above): with_audio $0.40/s, without_audio $0.20/s. Priced for the
    // with-audio worst case, same reasoning as Veo 3 Fast. The old 0.75 was
    // an unsourced placeholder, nearly double the real rate.
    pricePerSecondUsd: 0.4,
  },
  {
    id: "Sora 2",
    replicateModel: "openai/sora-2",
    // Best-effort, NOT live-verified (same caveat as Grok Imagine below):
    // prompt, seconds (4/8/12), image (i2v reference frame), native audio
    // track. Resolution is tied to aspect ratio on the base (non-Pro) tier
    // rather than an independent field, so only one resolution is exposed.
    imageField: "image",
    tier: "flagship",
    description: "OpenAI's video model, strong physics & realism, native audio",
    requiresScale: true,
    logo: SORA_ICON,
    supportsImageToVideo: true,
    supportsReferenceImages: true,
    supportsEndFrame: false,
    supportsAudio: true,
    durations: [4, 8, 12],
    aspectRatios: ["16:9", "9:16"],
    // CONFIRMED live: Sora 2's aspect_ratio is an enum of "landscape"/"portrait",
    // not the "16:9"/"9:16" ratio strings every other model here accepts --
    // it 422s otherwise ("aspect_ratio must be one of: \"portrait\", \"landscape\"").
    aspectRatioValues: { "16:9": "landscape", "9:16": "portrait" },
    resolutions: ["720p"],
    resolutionMode: "direct",
    // CONFIRMED (Replicate's own billingConfig, same source as Veo 3 Fast
    // above): "Standard quality" tier is $0.10/s flat, no audio-based
    // variant (the own-API-key tier isn't used here). Matches this app's
    // existing value exactly -- no change needed.
    pricePerSecondUsd: 0.1,
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
    supportsReferenceImages: true,
    supportsEndFrame: false, // no confirmed end-frame field for this model -- left off rather than guessed
    supportsAudio: true,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["720p", "1080p"],
    resolutionMode: "kling_mode",
    // CONFIRMED (Replicate's own billingConfig, same source as Veo 3 Fast
    // above): standard(720p)+audio $0.252/s, standard+no-audio $0.168/s,
    // pro(1080p)+audio $0.336/s, pro+no-audio $0.224/s. Priced for the
    // with-audio worst case at the 720p/standard baseline, same convention
    // as the Veo models above -- this app's shared VIDEO_RESOLUTION_MULTIPLIER
    // (pricing.ts) then derives 1080p as 0.252*1.5 = ~$0.378/s, somewhat
    // above the real pro+audio rate, i.e. this slightly OVER-charges at
    // 1080p rather than under-charging (same tradeoff Seedance 2.5 documents
    // below). The old 0.15 was an unsourced placeholder, well under even the
    // cheapest real tier.
    pricePerSecondUsd: 0.252,
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
    supportsReferenceImages: true,
    supportsEndFrame: true,
    supportsAudio: true,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    resolutions: ["720p", "480p"],
    // CONFIRMED (Replicate's own billingConfig, same source as Veo 3 Fast
    // above): non_video_in (this app has no video-to-video input, only
    // image, so this is the tier that applies) 720p $0.15/s, 480p $0.07/s.
    // Matches this app's existing value exactly -- no change needed.
    pricePerSecondUsd: 0.15,
  },
  {
    id: "Seedance 2.5",
    replicateModel: "bytedance/seedance-2.5",
    // Partially confirmed (Replicate's own model page + README, fetched
    // live -- the page's actual OpenAPI schema is client-rendered and
    // couldn't be scraped, same limitation this file's module header
    // already discloses for every other model here): prompt, duration
    // (4-30s, or -1 for "intelligent duration" -- not wired below, this
    // app's duration control is a fixed dropdown of concrete values, not a
    // free-form/-1 sentinel), aspect_ratio (supports "adaptive", also not
    // exposed -- this app's aspect-ratio control assumes literal W:H
    // ratios), resolution 480p/720p, native audio track. image/
    // last_frame_image field names are INFERRED (not independently
    // confirmed for 2.5 specifically) by continuity with Seedance 2's own
    // confirmed fields just above -- same ByteDance model family/schema
    // conventions. Reference images are real (up to 30 per the README) but
    // documented as referenced inline in the prompt via "[Image1]" etc.,
    // not necessarily as a plain array field -- referenceImagesField below
    // ("images") is a best-effort guess, not confirmed; the [Image#]
    // inline-mention convention itself isn't wired (Create's reference-image
    // control has no prompt-mention UI, unlike the Edit tab's
    // MentionTextarea). Verify all of the above live before the first real
    // deploy, per this file's usual discipline.
    imageField: "image",
    endFrameField: "last_frame_image",
    referenceImagesField: "images",
    resolutionMode: "direct",
    tier: "flagship",
    description: "ByteDance's flagship, native audio, up to 30s, huge reference sets",
    requiresScale: true,
    logo: SEEDANCE_ICON,
    supportsImageToVideo: true,
    supportsReferenceImages: true,
    maxReferenceImages: 30,
    supportsEndFrame: true,
    supportsAudio: true,
    durations: [5, 10, 15, 20, 30],
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    resolutions: ["720p", "480p"],
    // CONFIRMED via live search against Replicate's own published per-second
    // rates for this model (not directly scrapable from its pricing page in
    // this environment, but corroborated by an aggregator citing Replicate
    // specifically): $0.1028/s at 480p, $0.2312/s at 720p (both with no
    // video-clip reference input -- this app doesn't expose that input, see
    // above, so those are the two tiers that actually apply here). This
    // file's shared VIDEO_RESOLUTION_MULTIPLIER (pricing.ts) treats
    // pricePerSecondUsd as the 720p baseline for every model and derives
    // 480p/1080p off a single shared ratio -- 0.2312 here matches that
    // convention exactly; the multiplier's derived 480p figure (0.2312*0.6
    // = ~$0.139/s) is somewhat above Seedance 2.5's real 480p rate, i.e.
    // this slightly OVER-charges at 480p rather than under-charging.
    pricePerSecondUsd: 0.2312,
    // CONFIRMED live -- not a guess: a real submit with a long @-mention +
    // reference-instructions prompt 422ed with Replicate's own message
    // ("input.prompt: String length must be less than or equal to 2000"),
    // which is what exposed this cap existing at all.
    maxPromptLength: 2000,
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
    description: "xAI's video model, fast, expressive motion",
    logo: GROK_ICON,
    supportsImageToVideo: true,
    supportsReferenceImages: true,
    supportsEndFrame: false,
    supportsAudio: false,
    durations: [6],
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["720p", "480p"],
    // CONFIRMED (Replicate's own billingConfig, same source as Veo 3 Fast
    // above): flat $0.05/s, no resolution or audio-based criteria at all
    // (matches this model having no confirmed audio-toggle field either).
    // The old 0.2 was an unsourced placeholder, 4x the real rate.
    pricePerSecondUsd: 0.05,
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
  /** Replicate model slug, submitted as a prediction via submitVideoJob (same async, webhook-completed path every Create-tab model uses). */
  replicateModel: string;
  description: string;
  logo?: string;
  logoFullBleed?: boolean;
  /** Source video duration bounds this editing flow accepts -- carried over from the fal version, unverified against Replicate's schema. */
  minSourceDurationSeconds: number;
  maxSourceDurationSeconds: number;
  maxReferenceImages: number;
  /**
   * Field name the source video URL is sent under. Defaults to "video_url"
   * in generate-video/edit/route.ts when omitted -- that default was WRONG
   * for Kling (see Kling Edit's own entry below for how this was found),
   * which is exactly why this is now a per-model override instead of one
   * hardcoded literal shared by every model: different providers really do
   * use different field names here, confirmed live is the only way to know.
   */
  videoField?: string;
  /** Field name the reference-images array is sent under. Defaults to "image_urls" when omitted -- same per-model caveat as videoField. */
  referenceImagesField?: string;
  /** Extra static input fields merged into every Replicate request for this model (e.g. a mode flag the API requires to treat the source as editable base footage rather than a style reference). */
  extraInputFields?: Record<string, unknown>;
  pricePerSecondUsd: number;
}

export const EDIT_VIDEO_MODELS: PromptEditModelConfig[] = [
  {
    id: "Gemini Omni Flash",
    // MOVED off a direct call to Google's own Gemini API (POST
    // generativelanguage.googleapis.com/v1beta/interactions) onto Replicate's
    // hosted copy of the same model, google/gemini-omni-1.1 -- Google's API
    // was rejecting every request with a hard "limit: 0" free-tier quota on
    // this project's own API key (a billing/access problem on that project,
    // not something fixable in code), and Replicate's hosted version isn't
    // subject to that key's quota at all. Confirmed live against Replicate's
    // own openapi_schema for this model: `video` (a fetchable URL, not an
    // inline-base64 payload like the old direct-API path -- so the old
    // 18MB inline-size ceiling in gemini-video.ts no longer applies either)
    // and `reference_images` are the real field names; its own sample run
    // logs "model: gemini-omni-1.1-flash" under the hood, matching this
    // tile's name. gemini-video.ts (the old synchronous direct-API client)
    // and its after()-callback handling in generate-video/edit/route.ts are
    // gone now that this runs through the same async Replicate/webhook path
    // as every other edit model.
    replicateModel: "google/gemini-omni-1.1",
    description: "Follows edit instructions closely. Clips up to 10s.",
    logo: GEMINI_ICON,
    // Carried over from the old direct-API entry -- Replicate's schema
    // doesn't publish a duration constraint specific to its video-edit mode,
    // so this is still a best-effort bound, not independently reverified.
    minSourceDurationSeconds: 1,
    maxSourceDurationSeconds: 10,
    videoField: "video",
    referenceImagesField: "reference_images",
    maxReferenceImages: 4,
    // ESTIMATED -- Replicate doesn't expose this model's per-second rate via
    // its API and the pricing page didn't render it on a plain fetch;
    // correct against a real invoice once live.
    pricePerSecondUsd: 0.2,
  },
  {
    id: "Grok Imagine",
    replicateModel: "xai/grok-imagine-video",
    // Same Replicate slug Create's Grok Imagine tile uses (video-models.ts's
    // VIDEO_MODELS above) -- Replicate's own video-editing collection lists
    // this model as including "video editing mode alongside generation
    // capabilities for text-based modifications", so no separate slug for
    // edit. Field names left at the route's video_url/image_urls defaults
    // -- STILL UNVERIFIED (unlike Kling below, live lookups against
    // Replicate's own page and its README came back with no schema/code
    // sample for this specific model's edit-mode fields). If this model's
    // edits turn out to also ignore the source video (same symptom Kling's
    // video_url bug had), this is the first thing to re-check live.
    description: "Quick, affordable edits. Clips up to 8s.",
    logo: GROK_ICON,
    minSourceDurationSeconds: 1,
    maxSourceDurationSeconds: 8,
    maxReferenceImages: 4,
    pricePerSecondUsd: 0.12,
  },
  {
    id: "Kling Edit",
    replicateModel: "kwaivgi/kling-o1",
    description: "Best quality video edits.",
    logo: KLING_ICON,
    minSourceDurationSeconds: 3,
    maxSourceDurationSeconds: 10.05,
    maxReferenceImages: 4,
    // RE-CONFIRMED against Replicate's own live openapi_schema for this model
    // (GET /v1/models/kwaivgi/kling-o1, read straight from its
    // latest_version.openapi_schema.components.schemas.Input.properties --
    // not a page scrape) after a second report of the same "Kling Edit
    // ignores my uploaded video and generates something unrelated" symptom
    // the "video"/"reference_image_urls" fields below were supposedly fixed
    // for. Both were still wrong: the real fields are "reference_video" and
    // "reference_images". Worse, the schema also has a required-in-spirit
    // `video_reference_type` enum ("feature" | "base") that this route never
    // sent at all -- "feature" treats the clip as a loose style/camera
    // reference rather than footage to edit, so even sending the video under
    // the right key without this would still produce something only loosely
    // related to the source. "base" is what the edit flow needs.
    videoField: "reference_video",
    referenceImagesField: "reference_images",
    extraInputFields: { video_reference_type: "base" },
    pricePerSecondUsd: 0.168,
  },
];

export const DEFAULT_EDIT_VIDEO_MODEL = "Kling Edit";

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
