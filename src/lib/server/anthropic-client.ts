import { anthropic } from "@ai-sdk/anthropic";

// Reads ANTHROPIC_API_KEY from the environment automatically.
export const NICHE_BEND_MODEL = "claude-sonnet-5";

export const anthropicModel = anthropic(NICHE_BEND_MODEL);

// Claude Sonnet 5 supports up to 128K output tokens, but that requires
// streaming to avoid SDK HTTP timeouts — generateObject here is
// non-streaming, so this stays well under that ceiling.
export const CLAUDE_MAX_OUTPUT_TOKENS = 64000;
