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
    // UPDATE: the live openapi_schema (2026-11-04) confirms image /
    // last_frame_image, and that the references field is `reference_images`
    // -- the earlier "images" guess was silently dropped by Replicate. The
    // schema also says references can't be combined with first/last frames.
    imageField: "image",
    endFrameField: "last_frame_image",
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

// ── Clone tab (stored as mode "motion" / operation "motion_transfer") ────
// Competitor-parity "clone this video" tab: three tools, each offering a
// picker of models (the first listed is the default -- the strongest):
//
//   Motion transfer -- only the clip's motion carries over; people and place
//                      come from the reference images and prompt.
//   Object swap     -- changes only what's named; everything else stays as
//                      filmed (length, framing, motion, background).
//   Character       -- one photo performs the clip's moves, optionally with
//                      its sound, either in its own background or placed
//                      into the clip's scene ("Match background").
//
// Every model's real limits (clip length, reference count, resolutions) are
// enforced per model rather than per tool, since they differ a lot (Kling
// 4.0 takes 30s clips and 10 references; the Omni/O1 editors cap at 10s and
// 4). Seedance 2.5 stays available but isn't a default: ByteDance's filter
// rejects real human faces ("flagged as sensitive", E005 -- seen live on the
// first face-swap attempt), so it's offered for products and scenes.
//
// Field names, per engine, and how sure we are of them:
//   kling4       base_video / reference_videos / reference_images, @video_1 /
//                @image_N mentions, resolution, duration -- Replicate's page.
//   kling_omni   reference_video / reference_images / video_reference_type
//                -- confirmed live for Kling O1 (Edit tab); <<<image_N>>>
//                mentions per Kling's Omni API docs.
//   seedance     reference_videos / reference_images, [ImageN] mentions,
//                duration -1 + "adaptive" for edits -- Replicate's readme.
//   gemini_omni  video / reference_images -- confirmed live (Edit tab).
//   kling_motion image / video / character_orientation / keep_original_sound
//                -- published docs; `mode` values NOT live-verified.
//   wan_animate  video / character_image / resolution / merge_audio -- NOT
//                live-verified.
//   pruna_replace video / images / instruction_prompt / resolution /
//                save_audio -- prunaai/p-video-replace.
// UPDATE 2026-11-04: every field and enum above was checked against each
// model's live openapi_schema, and each tool's default ran end to end.
// Replicate 422s an unknown enum value on submit, but it silently DROPS an
// unknown field name, so a wrong field shows up as a job that ignores an input.
export type CloneToolId = "motion_transfer" | "object_swap" | "character";
export type CloneResolution = "480p" | "720p" | "1080p" | "auto";
export type CloneEngine = "kling4" | "kling_omni" | "seedance" | "gemini_omni" | "kling_motion" | "wan_animate" | "pruna_replace";

/** One runnable model choice -- `id` is what video_generations.model stores. */
export interface CloneModeConfig {
  id: string;
  /** Earlier ids this mode was stored under, so old history rows still resolve. */
  legacyIds?: string[];
  tool: CloneToolId;
  /** Name in the model picker. */
  modelLabel: string;
  description: string;
  logo?: string;
  logoFullBleed?: boolean;
  engine: CloneEngine;
  replicateModel: string;
  /** Wan only: the variant that keeps the clip's own scene, used when Match background is on (no frame pre-pass needed). */
  matchBackgroundReplicateModel?: string;
  /** Character only: always keeps the clip's own scene, so Photo background isn't offered. */
  matchBackgroundOnly?: boolean;
  /** First entry is the default. "auto" = the model has no resolution control. */
  resolutions: CloneResolution[];
  /** How the picked resolution reaches the model: a `resolution` field, Kling's `mode` field, or not at all. */
  resolutionInput: "resolution" | "mode" | "none";
  /** Literal value sent per resolution when it differs from the label (e.g. Kling's "standard"/"pro"). */
  resolutionValues?: Partial<Record<CloneResolution, string>>;
  minSourceDurationSeconds: number;
  maxSourceDurationSeconds: number;
  /** Smallest width/height the model ingests; uploads are scaled up to clear the strictest one (see video-normalize.ts). */
  minSourceSidePx?: number;
  maxReferenceImages: number;
  /** Caps the user's text, leaving room for the instructions wrapped around it. */
  maxPromptLength: number;
  /** ESTIMATED, per second of SOURCE clip (every engine renders the clip's own length). Correct against real Replicate invoices once live. */
  pricePerSecondUsd: Partial<Record<CloneResolution, number>>;
}

// Kling's two `mode` enums, read off each model's live Replicate schema:
// 3.0 Omni takes "standard"/"pro"; Motion Control (3.0 and 2.6) and O1 take
// "std"/"pro" -- "standard" there 422s before any work is done.
const KLING_STANDARD_PRO = { "720p": "standard", "1080p": "pro" } as Partial<Record<CloneResolution, string>>;
const KLING_STD_PRO = { "720p": "std", "1080p": "pro" } as Partial<Record<CloneResolution, string>>;

const KLING_4 = {
  logo: KLING_ICON,
  modelLabel: "Kling 4.0",
  engine: "kling4" as const,
  replicateModel: "kwaivgi/kling-v4.0",
  resolutions: ["720p", "1080p"] as CloneResolution[],
  resolutionInput: "resolution" as const,
  minSourceDurationSeconds: 3,
  maxSourceDurationSeconds: 30,
  minSourceSidePx: 700,
  maxReferenceImages: 10,
  maxPromptLength: 1500,
  // Replicate's published video-input rates are $0.094/s (720p) and
  // $0.141/s (1080p), billed on output length PLUS the longer of input and
  // output -- these tools output the clip's own length, so every source
  // second bills twice.
  pricePerSecondUsd: { "720p": 0.188, "1080p": 0.282 },
};

const KLING_3_OMNI = {
  logo: KLING_ICON,
  modelLabel: "Kling 3.0 Omni",
  engine: "kling_omni" as const,
  replicateModel: "kwaivgi/kling-v3-omni-video",
  resolutions: ["720p", "1080p"] as CloneResolution[],
  resolutionInput: "mode" as const,
  resolutionValues: KLING_STANDARD_PRO,
  // Kling's Omni models only accept 3-10s reference videos at 720px+ per
  // side, and 4 images alongside one.
  minSourceDurationSeconds: 3,
  maxSourceDurationSeconds: 10,
  minSourceSidePx: 720,
  maxReferenceImages: 4,
  maxPromptLength: 1500,
  // Same tier as Kling 3.0 video's confirmed standard/pro rates on Replicate.
  pricePerSecondUsd: { "720p": 0.168, "1080p": 0.224 },
};

const SEEDANCE_2_5 = {
  logo: SEEDANCE_ICON,
  modelLabel: "Seedance 2.5",
  engine: "seedance" as const,
  replicateModel: "bytedance/seedance-2.5",
  resolutions: ["720p", "480p"] as CloneResolution[],
  resolutionInput: "resolution" as const,
  minSourceDurationSeconds: 4,
  maxSourceDurationSeconds: 30,
  maxReferenceImages: 12,
  // Seedance rejects prompts over 2000 characters (confirmed live), and the
  // instructions wrapped around the user's text run up to ~600 of them.
  maxPromptLength: 1400,
  // Replicate's published Seedance 2.5 rates WITH a video input (several
  // times its text/image-only rates used by Create).
  pricePerSecondUsd: { "480p": 0.4304, "720p": 0.9676 },
};

const KLING_MOTION = {
  logo: KLING_ICON,
  engine: "kling_motion" as const,
  resolutions: ["720p", "1080p"] as CloneResolution[],
  resolutionInput: "mode" as const,
  resolutionValues: KLING_STD_PRO,
  minSourceDurationSeconds: 3,
  maxSourceDurationSeconds: 30,
  maxPromptLength: 1500,
};

// Borrowed from Kling 3.0 video's confirmed no-audio rates on Replicate
// (standard $0.168/s, pro $0.224/s) -- the motion-control sibling isn't
// published separately, and keeping the source soundtrack generates no new audio.
const KLING_3_MOTION_PRICE = { "720p": 0.168, "1080p": 0.224 };

export const CLONE_MODES: CloneModeConfig[] = [
  // ── Motion transfer ──
  {
    ...KLING_4,
    id: "Motion transfer (Kling 4.0)",
    legacyIds: ["Motion transfer"],
    tool: "motion_transfer",
    description: "Best overall. Clips up to 30s, 10 images.",
  },
  {
    ...KLING_MOTION,
    id: "Motion transfer (Kling 3.0 Motion)",
    tool: "motion_transfer",
    modelLabel: "Kling 3.0 Motion",
    description: "Sharpest body motion and faces. Clips up to 30s, 12 images.",
    replicateModel: "kwaivgi/kling-v3-motion-control",
    // The new first frame comes from Nano Banana Pro, which takes the source
    // frame plus up to 13 more images.
    maxReferenceImages: 12,
    pricePerSecondUsd: KLING_3_MOTION_PRICE,
  },
  {
    ...KLING_3_OMNI,
    id: "Motion transfer (Kling 3.0 Omni)",
    tool: "motion_transfer",
    description: "Tight shot-to-shot consistency. Clips up to 10s, 4 images.",
  },
  {
    ...SEEDANCE_2_5,
    id: "Motion transfer (Seedance 2.5)",
    tool: "motion_transfer",
    description: "Rich scenes and camera work. Can't use photos of real people.",
  },

  // ── Object swap ──
  {
    ...KLING_4,
    id: "Object swap (Kling 4.0)",
    tool: "object_swap",
    description: "Best overall. Clips up to 30s, 10 images.",
  },
  {
    ...KLING_3_OMNI,
    id: "Object swap (Kling 3.0 Omni)",
    tool: "object_swap",
    description: "Precise, local edits. Clips up to 10s, 4 images.",
  },
  {
    ...KLING_3_OMNI,
    id: "Object swap (Kling O1)",
    tool: "object_swap",
    modelLabel: "Kling O1",
    description: "Reliable everyday edits. Clips up to 10s, 4 images.",
    replicateModel: "kwaivgi/kling-o1",
    // No resolution control on Replicate's O1 (the Edit tab never sends one).
    resolutions: ["auto"],
    resolutionInput: "none",
    resolutionValues: undefined,
    // Kling O1's own 3-10.05s edit window (see Kling Edit above).
    maxSourceDurationSeconds: 10.05,
    pricePerSecondUsd: { auto: 0.168 },
  },
  {
    id: "Object swap (Gemini Omni)",
    tool: "object_swap",
    modelLabel: "Gemini Omni",
    description: "Follows detailed instructions closely. Clips up to 10s, 4 images.",
    logo: GEMINI_ICON,
    engine: "gemini_omni",
    replicateModel: "google/gemini-omni-1.1",
    resolutions: ["auto"],
    resolutionInput: "none",
    minSourceDurationSeconds: 1,
    maxSourceDurationSeconds: 10,
    maxReferenceImages: 4,
    maxPromptLength: 1500,
    // ESTIMATED, same figure as the Edit tab's Gemini Omni Flash tile.
    pricePerSecondUsd: { auto: 0.2 },
  },
  {
    ...SEEDANCE_2_5,
    id: "Object swap (Seedance 2.5)",
    // The first Object swap rows ran on Seedance under the bare tool name.
    legacyIds: ["Object swap"],
    tool: "object_swap",
    description: "Great for products and backgrounds. Can't use photos of real people.",
  },

  // ── Character ──
  {
    // The default: swaps the clip's performer for the photo, keeping the
    // clip's scene, motion, timing, camera and sound. Tested live against
    // Kling 3.0's Match background (frame pre-pass + Motion Control) on the
    // same 6s clip: it placed the character correctly where the rebuilt frame
    // had him standing on a table, in 51s instead of ~6 minutes, for about a
    // sixth of the cost. On a fast-cut montage it carries the first shot's
    // scene through every cut, so edits like that belong in Object swap.
    id: "Character (P-Video Replace)",
    tool: "character",
    modelLabel: "P-Video Replace",
    description: "Best for putting your character into the video's own scene. Fast.",
    engine: "pruna_replace",
    replicateModel: "prunaai/p-video-replace",
    matchBackgroundOnly: true,
    resolutions: ["720p", "1080p"],
    resolutionInput: "resolution",
    minSourceDurationSeconds: 2,
    // Not published; 13s ran fine live, and every other Character model stops at 30s.
    maxSourceDurationSeconds: 30,
    maxReferenceImages: 1,
    maxPromptLength: 1500,
    // Replicate's published rates, billed per second of output (the clip's own length).
    pricePerSecondUsd: { "720p": 0.03, "1080p": 0.06 },
  },
  {
    ...KLING_MOTION,
    id: "Character (Kling 3.0)",
    tool: "character",
    modelLabel: "Kling 3.0",
    description: "Smoothest motion. Works with your photo's background too.",
    replicateModel: "kwaivgi/kling-v3-motion-control",
    maxReferenceImages: 1,
    pricePerSecondUsd: KLING_3_MOTION_PRICE,
  },
  {
    ...KLING_MOTION,
    id: "Character (Kling 2.6)",
    tool: "character",
    modelLabel: "Kling 2.6",
    description: "Faster and cheaper, slightly less consistent.",
    replicateModel: "kwaivgi/kling-v2.6-motion-control",
    maxReferenceImages: 1,
    // Kling 2.6 Motion Control's published standard/pro per-second rates.
    pricePerSecondUsd: { "720p": 0.07, "1080p": 0.112 },
  },
  {
    id: "Character (Wan 2.2 Animate)",
    tool: "character",
    modelLabel: "Wan 2.2 Animate",
    description: "Budget open model. Matches the scene's lighting natively.",
    engine: "wan_animate",
    // "animation" animates the photo; "replace" swaps the clip's performer
    // for the character, keeping the clip's own scene and lighting.
    replicateModel: "wan-video/wan-2.2-animate-animation",
    matchBackgroundReplicateModel: "wan-video/wan-2.2-animate-replace",
    resolutions: ["720p", "480p"],
    resolutionInput: "resolution",
    resolutionValues: { "720p": "720", "480p": "480" },
    minSourceDurationSeconds: 3,
    maxSourceDurationSeconds: 30,
    maxReferenceImages: 1,
    maxPromptLength: 1500,
    // ESTIMATED -- Replicate bills Wan Animate per run (~$0.50 reported);
    // priced per second here, deliberately on the high side.
    pricePerSecondUsd: { "720p": 0.1, "480p": 0.05 },
  },
];

export function getCloneMode(id: string): CloneModeConfig | undefined {
  return CLONE_MODES.find((mode) => mode.id === id) ?? CLONE_MODES.find((mode) => mode.legacyIds?.includes(id));
}

/**
 * Whether a job first rebuilds the clip's opening frame (Nano Banana Pro)
 * before animating it: Kling Motion Control always animates a still, so it
 * needs one for Motion transfer (new people/place) and for Character's
 * Match background (character placed into the clip's scene). Wan does Match
 * background natively via its replace variant.
 */
export function cloneNeedsFrameStage(mode: CloneModeConfig, matchBackground: boolean): boolean {
  if (mode.engine !== "kling_motion") return false;
  return mode.tool === "motion_transfer" || (mode.tool === "character" && matchBackground);
}

/** UI copy for each tool in the mode menu. Limits come from the model the tool runs on. */
export interface CloneToolConfig {
  id: CloneToolId;
  label: string;
  description: string;
  videoTitle: string;
  imagesTitle: string;
  /** Fixed subline for single-photo tools; multi-image tools show the model's own cap. */
  imagesSubtitle?: string;
  placeholder: string;
  /** The prompt is the edit instruction itself, not an optional extra. */
  promptRequired: boolean;
  /**
   * The model this tool always runs on -- the Clone tab has no model picker,
   * so each tool uses the one that tested best end to end. The rest of
   * CLONE_MODES stays so older history rows still resolve.
   */
  mode: string;
  /** Character only: used when the user picks Photo background, since `mode` only does Match background. */
  photoBackgroundMode?: string;
}

export const CLONE_TOOLS: CloneToolConfig[] = [
  {
    id: "motion_transfer",
    label: "Motion transfer",
    description: "Keeps only the motion. The people and the place are new.",
    videoTitle: "Add the video to copy",
    imagesTitle: "Add people, outfits, products or places",
    placeholder: "Describe the new scene (optional), or type @ to use an image",
    promptRequired: false,
    mode: "Motion transfer (Kling 4.0)",
  },
  {
    id: "object_swap",
    label: "Object swap",
    description: "Changes only what you name. Everything else stays as filmed.",
    videoTitle: "Add the video to edit",
    imagesTitle: "Add what to swap in",
    placeholder: "Say what to change, or type @ to use an image",
    promptRequired: true,
    mode: "Object swap (Kling 4.0)",
  },
  {
    id: "character",
    label: "Character",
    description: "Your character performs the video's moves from one photo, with its sound if you like.",
    videoTitle: "Add the video to copy",
    imagesTitle: "Add your character",
    imagesSubtitle: "One clear photo",
    placeholder: "Describe the scene, clothing or camera movement (optional)",
    promptRequired: false,
    mode: "Character (P-Video Replace)",
    photoBackgroundMode: "Character (Kling 3.0)",
  },
];

export function getCloneTool(id: string): CloneToolConfig | undefined {
  return CLONE_TOOLS.find((tool) => tool.id === id);
}

/** The model a tool runs on for the given background choice (only Character has one). */
export function getCloneToolMode(tool: CloneToolConfig, matchBackground: boolean): CloneModeConfig {
  const id = tool.id === "character" && !matchBackground && tool.photoBackgroundMode ? tool.photoBackgroundMode : tool.mode;
  const mode = getCloneMode(id);
  if (!mode) throw new Error(`Clone tool "${tool.id}" points at unknown mode "${id}"`);
  return mode;
}

/** Every model the Clone tab can actually submit to -- what upload limits are gated on. */
export const CLONE_TOOL_MODES: CloneModeConfig[] = CLONE_TOOLS.flatMap((tool) =>
  [tool.mode, tool.photoBackgroundMode].flatMap((id) => {
    const mode = id ? getCloneMode(id) : undefined;
    return mode ? [mode] : [];
  })
);

/** The frame pre-pass (see cloneNeedsFrameStage): rebuilds the clip's first frame. */
export const CLONE_FRAME_MODEL = {
  replicateModel: "google/nano-banana-pro",
  /** Requested frame resolution per output resolution. */
  frameResolutions: { "480p": "1K", "720p": "1K", "1080p": "2K", auto: "1K" } as Record<CloneResolution, string>,
  /** ESTIMATED, one frame render per job. */
  priceUsd: 0.15,
};
