import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// OpenRouter's OpenAI-compatible endpoint. Reads OPENROUTER_API_KEY from the
// environment. Model IDs are OpenRouter slugs ("provider/model") -- see
// https://openrouter.ai/models for the catalog.
const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  // The generic OpenAI-compatible provider only sends response_format when
  // told the backend supports it -- otherwise generateObject's structured
  // calls fail outright.
  supportsStructuredOutputs: true,
});

// Perplexity's Sonar models are natively search-grounded (no ":online"
// suffix trick needed) -- purpose-built for "what's trending right now"
// research, replacing Gemini's googleSearch-grounded pass in niche-trend-ai.ts.
export const NICHE_TREND_RESEARCH_MODEL = "perplexity/sonar";
export const nicheTrendResearchModel = openrouter(NICHE_TREND_RESEARCH_MODEL);

// Plain instruct model with reliable JSON mode, for passes that don't need
// search grounding: script generation, niche-bend SOP/candidate extraction,
// transcript translation, and niche-report schema extraction/fallback.
// DeepSeek V3.2 -- best cost/quality tradeoff for creative script writing on
// OpenRouter as of this writing (~$0.27/$0.40 per MTok in/out vs. GPT-4o
// mini's ~$0.15/$0.60, with noticeably stronger prose and instruction
// following for narrative/hook-driven copy).
export const OPENROUTER_INSTRUCT_MODEL = "deepseek/deepseek-v3.2";
export const openrouterInstructModel = openrouter(OPENROUTER_INSTRUCT_MODEL);

export const OPENROUTER_MAX_OUTPUT_TOKENS = 16000;

// Google Gemini Flash via OpenRouter -- fast, cheap structured-output
// classification pass for the faceless-channel classifier (see
// lib/server/faceless-classifier.ts). Kept distinct from
// OPENROUTER_INSTRUCT_MODEL because this call is high-volume/low-latency
// (one per ingested channel) rather than a creative-writing pass.
// Originally gemini-flash-1.5, which OpenRouter has since retired --
// google/gemini-2.5-flash is the current pinned equivalent (checked against
// GET https://openrouter.ai/api/v1/models on 2026-08-08; the catalog now
// goes up to gemini-3.6-flash, but 2.5 is the long-stable, well-established
// tier rather than the newest/least-proven one).
export const FACELESS_CLASSIFIER_MODEL = "google/gemini-2.5-flash";
export const facelessClassifierModel = openrouter(FACELESS_CLASSIFIER_MODEL);
