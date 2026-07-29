import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// OpenRouter's OpenAI-compatible endpoint. Reads OPENROUTER_API_KEY from the
// environment. Model IDs are OpenRouter slugs ("provider/model") -- see
// https://openrouter.ai/models for the catalog.
const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  // Same reasoning as cloudflare-client.ts: the generic OpenAI-compatible
  // provider only sends response_format when told the backend supports it,
  // otherwise generateObject's structured calls fail outright.
  supportsStructuredOutputs: true,
});

// Perplexity's Sonar models are natively search-grounded (no ":online"
// suffix trick needed) -- purpose-built for "what's trending right now"
// research, replacing Gemini's googleSearch-grounded pass in niche-trend-ai.ts.
export const NICHE_TREND_RESEARCH_MODEL = "perplexity/sonar";
export const nicheTrendResearchModel = openrouter(NICHE_TREND_RESEARCH_MODEL);

// Plain instruct model with reliable JSON mode, for passes that don't need
// search grounding (schema extraction, script generation).
export const OPENROUTER_INSTRUCT_MODEL = "openai/gpt-4o-mini";
export const openrouterInstructModel = openrouter(OPENROUTER_INSTRUCT_MODEL);

export const OPENROUTER_MAX_OUTPUT_TOKENS = 16000;
