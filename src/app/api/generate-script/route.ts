import { NextRequest, NextResponse } from "next/server";
import { streamText, type LanguageModel, type ModelMessage } from "ai";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { GEMINI_MAX_OUTPUT_TOKENS, geminiModel } from "@/lib/server/gemini-client";
import { CLAUDE_MAX_OUTPUT_TOKENS, anthropicModel } from "@/lib/server/anthropic-client";
import { InsufficientCreditsError, chargeUser, refundUser } from "@/lib/server/credits";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

// Tried in order. If a model errors before producing any output (bad key,
// rate limit, retired model, etc.) the next candidate is tried. Once a
// model has started streaming text to the client we can no longer swap —
// the response is already committed — so a mid-stream failure just ends
// the response with a note appended, rather than restarting elsewhere.
const MODEL_CANDIDATES: { model: LanguageModel; maxOutputTokens: number; label: string }[] = [
  { model: geminiModel, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS, label: "gemini-flash-latest" },
  { model: anthropicModel, maxOutputTokens: CLAUDE_MAX_OUTPUT_TOKENS, label: "claude-sonnet-5" },
];

// CRITICAL: This is the absolute system prompt for script generation.
// Do not alter — it contains precise rules the AI model must follow.
function buildSystemPrompt(sop: string, transcripts: string, userRequest: string): string {
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

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface GenerateScriptRequestBody {
  message?: string;
  history?: HistoryMessage[];
  sop?: string;
  transcripts?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: GenerateScriptRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Charged here, before any model is touched -- nothing has hit the network
  // yet at this point, so a 402 costs nothing (unlike generate-image, no
  // response has been sent).
  try {
    await chargeUser(user.id, TOOL_CREDIT_COSTS.script.generation, "Script Generation", "script.generation");
  } catch (creditError) {
    if (creditError instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }
    throw creditError;
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const messages: ModelMessage[] = [
    ...history.map((entry) => ({ role: entry.role, content: entry.content }) satisfies ModelMessage),
    { role: "user", content: message },
  ];

  const systemPrompt = buildSystemPrompt(
    body.sop?.trim() || "No SOP provided.",
    body.transcripts?.trim() || "No transcripts provided.",
    message
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sentAnyOutput = false;
      let fullText = "";

      for (const candidate of MODEL_CANDIDATES) {
        try {
          const result = streamText({
            model: candidate.model,
            system: systemPrompt,
            messages,
            maxOutputTokens: candidate.maxOutputTokens,
          });

          for await (const chunk of result.textStream) {
            sentAnyOutput = true;
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          controller.close();
          if (fullText) {
            await supabase.from("scripts").insert({ user_id: user.id, prompt: message, content: fullText });
          }
          return;
        } catch (error) {
          console.error(`generate-script: ${candidate.label} failed`, error);

          if (sentAnyOutput) {
            controller.enqueue(
              encoder.encode("\n\n[Generation was interrupted due to an error. Please try again.]")
            );
            controller.close();
            return;
          }
          // Nothing streamed yet — safe to fall through and try the next model.
        }
      }

      // No candidate produced any output at all -- no value was delivered,
      // so refund the charge made above before erroring.
      await refundUser(user.id, TOOL_CREDIT_COSTS.script.generation, "Script Generation refund", "script.generation");
      controller.error(new Error("All script-generation models are currently unavailable."));
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
