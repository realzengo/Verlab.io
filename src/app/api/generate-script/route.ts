import { NextRequest, NextResponse } from "next/server";
import { streamText, type ModelMessage } from "ai";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { MODEL_CANDIDATES, buildSystemPrompt } from "@/lib/server/script-generation";
import { InsufficientCreditsError, chargeUser, refundUser } from "@/lib/server/credits";
import { withApiLogging } from "@/lib/server/api-logging";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

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

async function handlePOST(request: NextRequest): Promise<Response> {
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

          if (fullText) {
            await supabase.from("scripts").insert({ user_id: user.id, prompt: message, content: fullText });
          }
          controller.close();
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

export const POST = withApiLogging("/api/generate-script", handlePOST);
