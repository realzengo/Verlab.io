import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { MODEL_CANDIDATES, buildEditSystemPrompt } from "@/lib/server/script-generation";
import { InsufficientCreditsError, chargeUser, refundUser } from "@/lib/server/credits";
import { withApiLogging } from "@/lib/server/api-logging";
import { createClient } from "@/lib/supabase/server";
import { isSafeFreeText } from "@/lib/validation";

export const maxDuration = 300;

const CONTENT_MAX = 20000;
const INSTRUCTION_MAX = 2000;

interface EditChatRequestBody {
  scriptId?: string;
  content?: string;
  instruction?: string;
}

// Powers the "Ask AI to edit your script" panel in the script editor.
// Streams a full revised script back (same --- TITLE/SCRIPT/METRICS ---
// envelope as /api/generate-script, per buildEditSystemPrompt) and, once
// complete, persists it to the originating row so the edit survives a
// refresh -- mirrors generate-script's charge-before-stream/refund-on-total-
// failure pattern.
async function handlePOST(request: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: EditChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const scriptId = body.scriptId?.trim();
  const content = body.content?.trim();
  const instruction = body.instruction?.trim();

  if (!scriptId) {
    return NextResponse.json({ error: "scriptId is required" }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (!instruction) {
    return NextResponse.json({ error: "instruction is required" }, { status: 400 });
  }
  if (!isSafeFreeText(content, CONTENT_MAX)) {
    return NextResponse.json({ error: `content must be ${CONTENT_MAX} characters or fewer and contain no control characters or HTML tags` }, { status: 400 });
  }
  if (!isSafeFreeText(instruction, INSTRUCTION_MAX)) {
    return NextResponse.json({ error: `instruction must be ${INSTRUCTION_MAX} characters or fewer and contain no control characters or HTML tags` }, { status: 400 });
  }

  try {
    await chargeUser(user.id, TOOL_CREDIT_COSTS.script.edit, "Script Edit", "script.edit");
  } catch (creditError) {
    if (creditError instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }
    throw creditError;
  }

  const systemPrompt = buildEditSystemPrompt(content);
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
            messages: [{ role: "user", content: instruction }],
            maxOutputTokens: candidate.maxOutputTokens,
          });

          for await (const chunk of result.textStream) {
            sentAnyOutput = true;
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          if (fullText) {
            await supabase.from("scripts").update({ content: fullText }).eq("id", scriptId).eq("user_id", user.id);
          }
          controller.close();
          return;
        } catch (error) {
          console.error(`scripts/edit-chat: ${candidate.label} failed`, error);

          if (sentAnyOutput) {
            controller.enqueue(
              encoder.encode("\n\n[Edit was interrupted due to an error. Please try again.]")
            );
            controller.close();
            return;
          }
        }
      }

      await refundUser(user.id, TOOL_CREDIT_COSTS.script.edit, "Script Edit refund", "script.edit");
      controller.error(new Error("All script-editing models are currently unavailable."));
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export const POST = withApiLogging("/api/scripts/edit-chat", handlePOST);
