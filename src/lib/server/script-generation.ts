import { streamText, type LanguageModel, type ModelMessage } from "ai";
import { OPENROUTER_INSTRUCT_MODEL, OPENROUTER_MAX_OUTPUT_TOKENS, openrouterInstructModel } from "@/lib/server/openrouter-client";
import { CLAUDE_MAX_OUTPUT_TOKENS, anthropicModel } from "@/lib/server/anthropic-client";

// Shared between the streaming web route (api/generate-script) and the MCP
// tool (which needs the full text in one shot, not a stream) so the model
// fallback order and prompt stay a single source of truth.
export const MODEL_CANDIDATES: { model: LanguageModel; maxOutputTokens: number; label: string }[] = [
  { model: openrouterInstructModel, maxOutputTokens: OPENROUTER_MAX_OUTPUT_TOKENS, label: OPENROUTER_INSTRUCT_MODEL },
  { model: anthropicModel, maxOutputTokens: CLAUDE_MAX_OUTPUT_TOKENS, label: "claude-sonnet-5" },
];

// CRITICAL: This is the absolute system prompt for script generation.
// Do not alter — it contains precise rules the AI model must follow.
export function buildSystemPrompt(sop: string, transcripts: string, userRequest: string): string {
  return `You are an elite scriptwriter and analytical engine for short-form video content (YouTube Shorts, TikTok, Reels). Your objective is to reverse-engineer a competitor's exact content formula and apply it to a new topic provided by the user.

You will receive three dynamic inputs:
1. <COMPETITOR_SOP>: The standard operating procedure, rules, and guidelines of the target channel.
2. <COMPETITOR_TRANSCRIPTS>: Real, high-performing transcripts from the target channel.
3. <USER_REQUEST>: The specific topic, theme, or video description the user wants you to write about.

═══════════════════════════════════════
PHASE 1: THE ANALYZER (Internal Processing)
═══════════════════════════════════════
Before generating any user-facing output, silently analyze the <COMPETITOR_SOP> and <COMPETITOR_TRANSCRIPTS>. You must extract and adopt the following parameters:

- CORE FORMULA: Identify the narrative beats (e.g., Action → Reason → Consequence).
- PACING & LENGTH: Determine the average word count range and the hard maximum limit.
- HOOK STRUCTURE: Analyze how the first 3-5 seconds grab attention.
- TONE & POV: Identify the voice (e.g., dark, educational, frantic) and the point of view (1st, 2nd, or 3rd person).
- RESTRICTIONS: Note any banned words, specific formatting rules, or stylistic red flags mentioned in the SOP.
- REVEAL DEVICES: Identify how the scripts transition from the setup to the payoff (e.g., "You see," "The crazy part is," etc.).

═══════════════════════════════════════
PHASE 2: EXECUTION MODES
═══════════════════════════════════════
Based on the <USER_REQUEST>, execute ONE of the following modes:

MODE 1: IDEA GENERATION (Triggered if the user asks for ideas, themes, or a broad topic)
1. Research the requested topic using your internal knowledge.
2. Generate exactly 10 script ideas that perfectly fit the analyzed competitor formula.
3. Format each idea strictly as follows:

[Idea Number]. [One-line description of the story/fact]
HOOK: "[Full opening sentence, strictly matching a competitor hook template]"
STRUCTURAL BEAT: [Which specific template/SOP rule this follows]
VIRAL TRIGGER: [1-2 sentences on why this specific angle will retain viewers]

MODE 2: SCRIPTING (Triggered if the user provides a specific topic, title, or says "script this")
1. Draft the script adhering 100% to the beats, pacing, and voice extracted in Phase 1.
2. Every word must earn its place. Do not include filler, preamble, or moralizing conclusions unless explicitly found in the competitor transcripts.
3. Perform a silent word-economy check: cut 20% of the filler words before outputting.
4. Output format strictly as follows:

---
TITLE: [Generate a title matching the competitor's exact naming conventions]

SCRIPT:
[The full script, written as one continuous block or separated by structural beats as defined by the SOP]

METRICS:
- Word Count: [X words]
- Extracted Hook Type: [Name of the competitor hook style used]
- Applied Reveal Device: [The transition device used]
---

═══════════════════════════════════════
DYNAMIC INPUT DATA
═══════════════════════════════════════

<COMPETITOR_SOP>
${sop}
</COMPETITOR_SOP>

<COMPETITOR_TRANSCRIPTS>
${transcripts}
</COMPETITOR_TRANSCRIPTS>

<USER_REQUEST>
${userRequest}
</USER_REQUEST>`;
}

/**
 * Buffered counterpart to the streaming loop in api/generate-script/route.ts
 * — same candidate order and fallback-on-empty-output behavior, but returns
 * the full text in one shot instead of forwarding chunks to a client stream.
 * Used by the MCP `generate_script` tool, which returns a single tool result
 * rather than a stream.
 */
export async function generateScriptText(systemPrompt: string, messages: ModelMessage[]): Promise<string> {
  for (const candidate of MODEL_CANDIDATES) {
    try {
      const result = streamText({
        model: candidate.model,
        system: systemPrompt,
        messages,
        maxOutputTokens: candidate.maxOutputTokens,
      });

      const text = await result.text;
      if (text) return text;
    } catch (error) {
      console.error(`generate-script (mcp): ${candidate.label} failed`, error);
    }
  }

  throw new Error("All script-generation models are currently unavailable.");
}
