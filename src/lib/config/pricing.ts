// Central credit-pricing config. Every credit-metered action must keep our
// underlying API/compute cost at or below 30% of the credit revenue it earns
// (>=70% margin). Costs below are ESTIMATED market rates (no live provider
// invoices available) -- each entry's derivation is commented so the numbers
// stay auditable and easy to correct as real invoices come in.

import { getVideoModel, getEditVideoModel } from "./video-models";

// 1 credit = $0.015 (the $15 / 1000-credit Creator plan rate).
export const CREDIT_VALUE_USD = 0.015;
export const MIN_MARGIN = 0.7;
export const MAX_COST_PER_CREDIT_USD = CREDIT_VALUE_USD * (1 - MIN_MARGIN); // 0.0045

// Converts an estimated worst-case USD cost into the credits needed to keep
// margin >=70%. Always rounds UP (rounding down would silently violate the
// margin guarantee) and floors at 1 -- no paid action bills a fractional
// credit; 0 is reserved for genuinely free actions (see video.compressWasm).
function creditsForCost(estimatedCostUsd: number): number {
  return Math.max(1, Math.ceil(estimatedCostUsd / MAX_COST_PER_CREDIT_USD));
}

// Stable, machine-readable action_key suffix from a model display name, e.g.
// "Nano Banana Pro" -> "nano_banana_pro".
export function slugifyModelName(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ── Flat-cost tools ─────────────────────────────────────────────────────

// Apify actor run (streamers~youtube-scraper / clockworks~tiktok-profile-
// scraper, run-sync-get-dataset-items, ~10 videos) ~$0.06, plus the
// ScrapeCreators fallback that fires on Apify failure ~$0.025 (priced for the
// worst case where both providers get billed on the same request), plus one
// Cloudflare mistral-small research call ~$0.003.
const NICHE_BEND_ANALYZE_SCRAPE_COST_USD = 0.06 + 0.025 + 0.003;
// Cache-hit / manual-videos branches skip scraping entirely and only run one
// Cloudflare mistral-small call (regenerateCandidates / researchFromManualVideos).
const NICHE_BEND_ANALYZE_LIGHT_COST_USD = 0.006;
// Two sequential Cloudflare mistral-small calls (generateSopContent), each up
// to 12000/16000 max output tokens but typically far below that ceiling;
// estimated ~3000 in / 4000 out tokens per call, ~$0.05/$0.15 per MTok.
const NICHE_BEND_SOP_COST_USD = (6000 / 1e6) * 0.05 + (8000 / 1e6) * 0.15;
// One Cloudflare mistral-small call, 1000 max output tokens, small context.
const NICHE_BEND_REGENERATE_CANDIDATE_COST_USD = (600 / 1e6) * 0.05 + (400 / 1e6) * 0.15;
// Real Claude Sonnet 5 pricing: $3/$15 per MTok in/out (anthropic-client.ts).
// Priced for the worst case (Claude serving the request) even though Gemini
// usually serves it first and is cheaper -- the user is charged one
// consistent price regardless of which model served it under the hood.
// Estimated ~2500 input tokens (SOP + transcripts + history) / ~2000 output
// tokens (a script or 10 ideas).
const SCRIPT_GENERATION_COST_USD = (2500 / 1e6) * 3 + (2000 / 1e6) * 15;
// ScrapeCreators: 2 calls per video (metadata + transcript), ~$0.015 each.
const TRANSCRIPTS_EXTRACT_COST_USD = 0.015 * 2;
// Cloudflare mistral-small, batched 20 lines/call; ~3 batches average.
const TRANSCRIPTS_TRANSLATE_COST_USD = 0.0005 * 3;
// video-download-api.com / savenow.to per-download charge.
const DOWNLOADS_CREATE_COST_USD = 0.01;
// One ScrapeCreators channel-listing call for video URLs+views (see
// scrapeChannelVideosWithUrls in apify-client.ts). Priced for the YouTube
// worst case (2 parallel calls: channel info + shorts list); TikTok is a
// single call and costs less in practice.
const CREATOR_ANALYSIS_SCRAPE_COST_USD = 0.015 * 2;
// One Claude Sonnet 5 call (anthropic-client.ts pricing) over ~5 aggregated
// video transcripts (~6000 input tokens: titles + concatenated transcript
// text) producing one ~180-word paragraph (~300 output tokens).
const CREATOR_ANALYSIS_LLM_COST_USD = (6000 / 1e6) * 3 + (300 / 1e6) * 15;

export const TOOL_CREDIT_COSTS = {
  nicheBend: {
    analyzeScrape: creditsForCost(NICHE_BEND_ANALYZE_SCRAPE_COST_USD),
    analyzeCacheHit: creditsForCost(NICHE_BEND_ANALYZE_LIGHT_COST_USD),
    analyzeManualVideos: creditsForCost(NICHE_BEND_ANALYZE_LIGHT_COST_USD),
    // Mathematically rounds to 1, but bumped to a floor of 2 as a small
    // buffer -- the 12000/16000-token ceilings mean real usage variance is
    // wide, and 2 credits costs the user essentially nothing extra while
    // giving real headroom against margin.
    sop: Math.max(2, creditsForCost(NICHE_BEND_SOP_COST_USD)),
    regenerateCandidate: creditsForCost(NICHE_BEND_REGENERATE_CANDIDATE_COST_USD),
  },
  script: {
    generation: creditsForCost(SCRIPT_GENERATION_COST_USD),
  },
  transcripts: {
    extract: creditsForCost(TRANSCRIPTS_EXTRACT_COST_USD),
    translate: creditsForCost(TRANSCRIPTS_TRANSLATE_COST_USD),
  },
  downloads: {
    create: creditsForCost(DOWNLOADS_CREATE_COST_USD),
  },
  creatorAnalysis: {
    // 5 real transcript extractions (transcripts.extract cost each) + one
    // channel-listing scrape + one LLM summary call, charged as a single
    // flat fee regardless of how many of the 5 transcripts actually succeed
    // (analyze_creator proceeds on partial success -- see tools.ts).
    analyze:
      5 * creditsForCost(TRANSCRIPTS_EXTRACT_COST_USD) +
      creditsForCost(CREATOR_ANALYSIS_SCRAPE_COST_USD) +
      creditsForCost(CREATOR_ANALYSIS_LLM_COST_USD),
  },
  video: {
    // Client-side FFmpeg WASM compression -- zero server compute. chargeUser
    // special-cases 0 and skips the DB entirely (see src/lib/server/credits.ts).
    compressWasm: 0,
  },
  // Video Generator's Edit tab -- flat per-operation costs (not priced per
  // model like Create, since each operation maps to exactly one fal app).
  // ESTIMATED, same disclosure as everything else in this file -- correct
  // against real fal invoices once the exact fal apps in video-models.ts's
  // VIDEO_EDIT_OPERATIONS are live-verified.
  videoEdit: {
    upscale: creditsForCost(0.15),
    reframe: creditsForCost(0.12),
    // "Extend" reuses a Create-tab i2v model rather than a dedicated fal
    // app (see video-models.ts) -- priced the same way Create itself is
    // (getVideoGenerationCost below), so no flat entry here.
  },
  // Video Generator's Motion tab -- same estimation caveat as videoEdit.
  videoMotion: {
    transfer: creditsForCost(0.2),
  },
} as const;

// ── Image generation ────────────────────────────────────────────────────
// Cost genuinely varies by model x resolution x quality x outputs, and two
// models (Nano Banana Pro, GPT Image 2) are real fal.ai/OpenAI pass-through
// billing while the rest are cheap in-house Cloudflare Workers AI compute
// rebranded with consumer-friendly names (see cloudflare-image.ts). A pure
// function over a small per-model table is used instead of one giant
// multiplier matrix.

export type ImageResolution = "512px" | "1K" | "2K" | "4K";
export type ImageQuality = "auto" | "low" | "medium" | "high";

interface ImageModelPricing {
  /** Credits for one output at the model's base tier (no reference image). */
  baseCredits: number;
  /**
   * Credits for one output WHEN a reference image is supplied -- this
   * REPLACES baseCredits entirely rather than adding to it, because
   * cloudflare-image.ts always routes a reference image to a real fal.ai
   * /edit endpoint regardless of model (no Cloudflare path exists for
   * img2img), so the cost basis changes completely, not incrementally.
   * Undefined for models already fal-priced at full rate (Pro / GPT Image 2)
   * -- their /edit endpoint is the same price tier as their normal endpoint.
   */
  referenceImageCredits?: number;
  /** Real fal.ai resolution tiers -- only Nano Banana Pro has this param. */
  resolutionCredits?: Partial<Record<ImageResolution, number>>;
  /** Real fal.ai quality param -- only GPT Image 2 has this param. */
  qualityCredits?: Partial<Record<ImageQuality, number>>;
}

// Real fal.ai nano-banana pass-through cost when a reference image forces
// the /edit endpoint on an otherwise-cheap Cloudflare-backed model (~$0.025/image).
const FAL_NANO_BANANA_EDIT_CREDITS = creditsForCost(0.025);

// $ derivations (ESTIMATED):
//  - Cloudflare flux-1-schnell / sdxl-lightning (Nano Banana, Nano Banana 2
//    Lite): ~$0.0006/image -> 1 credit.
//  - Cloudflare lucid-origin (Nano Banana 2, auto/low quality): ~$0.0025/image -> 1-2 credits.
//  - fal.ai nano-banana-pro (real Gemini 3 Pro Image pass-through, always
//    fal-first per PREFER_FAL_MODELS): ~$0.04/$0.05/$0.08/$0.14 at
//    512px/1K/2K/4K. Nano Banana 2 at medium/high quality resolves to this
//    same model (see QUALITY_MODEL_LADDER in cloudflare-image.ts / the
//    resolveQualityModel() call in the route), so it picks up this pricing
//    automatically rather than needing a separate surcharge entry.
//  - fal.ai openai/gpt-image-2 (real pass-through, always fal-first): real
//    `quality` param -- ~$0.02/$0.02/$0.07/$0.19 at auto/low/medium/high (1K).
export const IMAGE_MODEL_PRICING: Record<string, ImageModelPricing> = {
  "Nano Banana": { baseCredits: 1, referenceImageCredits: FAL_NANO_BANANA_EDIT_CREDITS },
  "Nano Banana 2 Lite": { baseCredits: 1, referenceImageCredits: FAL_NANO_BANANA_EDIT_CREDITS },
  "Nano Banana 2": { baseCredits: 2, referenceImageCredits: FAL_NANO_BANANA_EDIT_CREDITS },
  "Nano Banana Pro": {
    baseCredits: creditsForCost(0.05),
    resolutionCredits: {
      "512px": creditsForCost(0.04),
      "1K": creditsForCost(0.05),
      "2K": creditsForCost(0.08),
      "4K": creditsForCost(0.14),
    },
  },
  "GPT Image 2": {
    baseCredits: creditsForCost(0.02),
    qualityCredits: {
      auto: creditsForCost(0.02),
      low: creditsForCost(0.02),
      medium: creditsForCost(0.07),
      high: creditsForCost(0.19),
    },
  },
};

// GPT Image 2's resolution isn't a real fal param on its own (it derives
// width/height from aspectRatio+resolution like everything else), but larger
// renders still cost fal more -- apply a resolution multiplier on top of the
// quality-tier credits.
const GPT_IMAGE_2_RESOLUTION_MULTIPLIER: Record<ImageResolution, number> = {
  "512px": 0.7,
  "1K": 1,
  "2K": 1.6,
  "4K": 2.5,
};

/**
 * `model` must already be quality-resolved (see resolveQualityModel() in
 * cloudflare-image.ts) -- e.g. "Nano Banana 2" at medium/high quality
 * resolves to "Nano Banana Pro" before real work happens, and cost must be
 * computed against the model that actually runs, not the one the user picked
 * in the dropdown.
 */
export function getImageGenerationCost(input: {
  model: string;
  resolution: ImageResolution;
  quality: ImageQuality;
  outputs: number;
  hasReferenceImage: boolean;
}): number {
  const pricing = IMAGE_MODEL_PRICING[input.model];
  if (!pricing) {
    throw new Error(`No pricing configured for image model "${input.model}"`);
  }

  const outputs = Math.max(1, input.outputs);

  if (input.hasReferenceImage && pricing.referenceImageCredits !== undefined) {
    return pricing.referenceImageCredits * outputs;
  }

  let perImageCredits = pricing.baseCredits;

  if (pricing.resolutionCredits?.[input.resolution] !== undefined) {
    perImageCredits = pricing.resolutionCredits[input.resolution]!;
  }

  if (pricing.qualityCredits?.[input.quality] !== undefined) {
    perImageCredits = pricing.qualityCredits[input.quality]!;
    if (input.model === "GPT Image 2") {
      perImageCredits = Math.max(1, Math.ceil(perImageCredits * GPT_IMAGE_2_RESOLUTION_MULTIPLIER[input.resolution]));
    }
  }

  return perImageCredits * outputs;
}

// ── Video generation (Create tab) ───────────────────────────────────────
// Cost is genuinely per-model (fal bills each video model at its own real
// $/second rate -- see VIDEO_MODELS in video-models.ts), so this reads the
// same pricePerSecondUsd table rather than duplicating it here. Deliberately
// NOT imported the other way around (video-models.ts stays pricing-agnostic,
// same separation cloudflare-image.ts keeps from this file).

// Resolution isn't priced per-model like pricePerSecondUsd is -- fal doesn't
// publish separate $/s rates per resolution tier for these apps -- but a
// 1080p render is genuinely more compute than 720p, and 480p less, so apply
// the same kind of estimated multiplier GPT_IMAGE_2_RESOLUTION_MULTIPLIER
// uses above. pricePerSecondUsd is treated as the 720p baseline (matches
// every model's schema default, see video-models.ts module header).
const VIDEO_RESOLUTION_MULTIPLIER: Record<string, number> = {
  "480p": 0.6,
  "720p": 1,
  "1080p": 1.5,
};

export function getVideoGenerationCost(input: { model: string; durationSeconds: number; outputs: number; resolution?: string }): number {
  const config = getVideoModel(input.model);
  if (!config) {
    throw new Error(`No pricing configured for video model "${input.model}"`);
  }

  const outputs = Math.max(1, input.outputs);
  const multiplier = (input.resolution && VIDEO_RESOLUTION_MULTIPLIER[input.resolution]) || 1;
  const perVideoCredits = creditsForCost(config.pricePerSecondUsd * multiplier * input.durationSeconds);
  return perVideoCredits * outputs;
}

// ── Video generation (Edit tab: prompt-based editing) ──────────────────
// Output duration always matches the source video's (fal preserves the
// original motion/length, no user-selectable duration -- see
// EDIT_VIDEO_MODELS's module comment), so cost is priced off the source
// clip's own duration rather than a picker value.
export function getVideoPromptEditCost(input: { model: string; sourceDurationSeconds: number; outputs: number }): number {
  const config = getEditVideoModel(input.model);
  if (!config) {
    throw new Error(`No pricing configured for edit model "${input.model}"`);
  }

  const outputs = Math.max(1, input.outputs);
  const perVideoCredits = creditsForCost(config.pricePerSecondUsd * input.sourceDurationSeconds);
  return perVideoCredits * outputs;
}

// ── Subscription plans ──────────────────────────────────────────────────
// NOTE: this is a credit-focused reference constant, distinct from the
// existing `plan_definitions` DB table (supabase/migrations/20260716120012_
// plan_definitions.sql, id in ('core','pro','scale'), $19/$39/$89 pricing),
// which remains the source of truth for admin-editable marketing copy. The
// naming/pricing here doesn't reconcile 1:1 with those rows -- that's a
// product decision for later, not resolved by this config. This constant
// seeds `plan_definitions.credits_per_period` and is meant for a future
// billing/webhook handler (none exists in this repo yet) that grants
// recurring credits on plan renewal.
export const SUBSCRIPTION_PLANS = {
  free: { id: "free", name: "Free", priceMonthly: 0, credits: 50, recurring: false },
  creator: { id: "creator", name: "Creator", priceMonthly: 15, credits: 1000, recurring: true },
  pro: { id: "pro", name: "Pro", priceMonthly: 39, credits: 3000, recurring: true },
} as const;
