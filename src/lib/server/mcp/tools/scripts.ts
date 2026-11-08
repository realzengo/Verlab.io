import "server-only";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundUser } from "@/lib/server/credits";
import { recordUsageEvent } from "@/lib/server/usage";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { generateScriptText, buildSystemPrompt } from "@/lib/server/script-generation";
import { FREE_TEXT_MAX, isSafeFreeText } from "@/lib/validation";
import { loadSopText } from "./bend";
import { appResult, chargeUpfront, CREATES, errorResult, UUID_PATTERN, type McpToolDefinition } from "./shared";

const MAX_TRANSCRIPT_IDS = 5;
const MAX_TRANSCRIPTS_CHARS = 60_000;

/** Joins this user's finished transcripts into the example block the script prompt expects. */
async function loadTranscriptsText(userId: string, ids: string[]): Promise<string> {
  const valid = ids.filter((id) => UUID_PATTERN.test(id)).slice(0, MAX_TRANSCRIPT_IDS);
  if (!valid.length) return "";
  const { data } = await createAdminClient()
    .from("transcripts")
    .select("id, title, lines")
    .eq("user_id", userId)
    .eq("status", "complete")
    .in("id", valid);
  return (data ?? [])
    .map((row) => {
      const lines = Array.isArray(row.lines) ? (row.lines as { text?: string }[]) : [];
      return `--- ${row.title ?? "Transcript"} ---\n${lines.map((line) => line.text ?? "").join(" ")}`;
    })
    .join("\n\n")
    .slice(0, MAX_TRANSCRIPTS_CHARS);
}

const generateScriptTool: McpToolDefinition = {
  name: "generate_script",
  title: "Generate a script",
  description:
    "Writes a short-form video script (or a list of video ideas) in a proven channel's style. Best results come from grounding it: pass sopId (a bend_niche " +
    "job with a finished SOP) and/or transcriptIds (from extract_transcript) and Verlab loads them itself; or paste sop/transcripts text directly. " +
    "Saved to the user's Verlab scripts. Charges credits (refunded if it fails).",
  inputSchema: {
    message: z.string().describe("The topic, or an instruction like 'give me 10 ideas' or 'script this: ...'."),
    sopId: z.string().optional().describe("A bend_niche job id whose SOP should drive the style."),
    transcriptIds: z.array(z.string()).max(MAX_TRANSCRIPT_IDS).optional().describe("Up to 5 extract_transcript ids to use as style examples."),
    sop: z.string().optional().describe("SOP/style notes as text, if not using sopId."),
    transcripts: z.string().optional().describe("Example transcripts as text, if not using transcriptIds."),
  },
  annotations: CREATES,
  handler: async (userId, args) => {
    const message = String(args.message ?? "").trim();
    if (!message) return errorResult("Tell me what the script should be about.", "invalid_input");
    if (!isSafeFreeText(message, FREE_TEXT_MAX)) {
      return errorResult(`The request must be ${FREE_TEXT_MAX} characters or fewer, without HTML tags.`, "invalid_input");
    }

    const sopId = typeof args.sopId === "string" ? args.sopId.trim() : "";
    let sop = String(args.sop ?? "").trim();
    if (sopId) {
      const loaded = await loadSopText(userId, sopId);
      if (!loaded) return errorResult("No finished SOP was found for that sopId. Use a bend_niche job whose SOP is ready.", "not_found");
      sop = sop ? `${loaded}\n\nExtra notes:\n${sop}` : loaded;
    }

    const transcriptIds = Array.isArray(args.transcriptIds) ? args.transcriptIds.map(String) : [];
    let transcripts = String(args.transcripts ?? "").trim();
    if (transcriptIds.length) {
      const loaded = await loadTranscriptsText(userId, transcriptIds);
      if (!loaded) return errorResult("None of those transcript ids are finished transcripts on this account.", "not_found");
      transcripts = transcripts ? `${loaded}\n\n${transcripts}` : loaded;
    }

    const cost = TOOL_CREDIT_COSTS.script.generation;
    const charged = await chargeUpfront(userId, cost, "Script Generation", "script.generation");
    if (charged) return charged;

    const systemPrompt = buildSystemPrompt(sop || "No SOP provided.", transcripts || "No transcripts provided.", message);
    const messages: ModelMessage[] = [{ role: "user", content: message }];

    try {
      const text = await generateScriptText(systemPrompt, messages);
      if (!text.trim()) throw new Error("The model returned an empty script");
      const { data: row } = await createAdminClient()
        .from("scripts")
        .insert({ user_id: userId, prompt: message, content: text })
        .select("id")
        .single();
      recordUsageEvent("mcp", userId, { action: "script.generation" });
      return appResult(`${text}\n\n(Saved to Verlab as script ${row?.id ?? "n/a"}.)`, { text, cost, id: row?.id ?? "", prompt: message });
    } catch (error) {
      console.error("[mcp/generate_script]", error);
      await refundUser(userId, cost, "Script Generation refund", "script.generation");
      return errorResult("Script generation failed. Your credits were refunded -- please try again.");
    }
  },
};

export const SCRIPT_TOOLS: McpToolDefinition[] = [generateScriptTool];
