import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Cloudflare Workers AI's OpenAI-compatible endpoint. Reads
// CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN from the environment.
const cloudflare = createOpenAICompatible({
  name: "cloudflare-workers-ai",
  baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
  apiKey: process.env.CLOUDFLARE_API_TOKEN,
  // Cloudflare's endpoint supports json_schema response formatting, but the
  // generic OpenAI-compatible provider only sends it when told the backend
  // supports it — otherwise generateObject's structured calls fail outright.
  supportsStructuredOutputs: true,
});

// mistral-small-3.1-24b-instruct chosen over llama-3.3-70b-instruct-fp8-fast:
// the latter was tested and intermittently baked view-count text into the
// echoed video title field, corrupting real data instead of just formatting it.
export const NICHE_BEND_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

export const nicheBendModel = cloudflare(NICHE_BEND_MODEL);

export const CLAUDE_MAX_OUTPUT_TOKENS = 16000;
