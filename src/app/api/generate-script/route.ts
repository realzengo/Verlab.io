import { NextRequest, NextResponse, after } from "next/server";
import { streamText, type ModelMessage } from "ai";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { MODEL_CANDIDATES, buildSystemPrompt } from "@/lib/server/script-generation";
import { InsufficientCreditsError, chargeUser, refundUser } from "@/lib/server/credits";
import { withApiLogging } from "@/lib/server/api-logging";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isSafeFreeText, FREE_TEXT_MAX } from "@/lib/validation";

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
  /** Client-chosen id for the scripts row this generation saves into. */
  scriptId?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handlePOST(request: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`generate-script:${user.id}`, 10, 60))) {
    return rateLimitedResponse();
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
  if (!isSafeFreeText(message, FREE_TEXT_MAX)) {
    return NextResponse.json({ error: `message must be ${FREE_TEXT_MAX} characters or fewer and contain no control characters or HTML tags` }, { status: 400 });
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

  // The client names the row up front so the Script Writer can still find the
  // finished script after the user left the page mid-stream and came back
  // (see lib/client/script-generation.ts). Anything else gets a fresh id.
  const scriptId = typeof body.scriptId === "string" && UUID_PATTERN.test(body.scriptId) ? body.scriptId : crypto.randomUUID();

  const encoder = new TextEncoder();

  // The response stream only *mirrors* the generation below. When the user
  // leaves the page (closes the tab, reloads, follows a link), Next aborts
  // the pipe and cancels this stream -- `client` drops to null and the model
  // keeps writing regardless, so the script still gets saved and lands in
  // their history. Writing straight into the controller (as this route used
  // to) made the first enqueue after a disconnect throw, which killed the
  // generation after the credits were already charged.
  let client: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      client = controller;
    },
    cancel() {
      client = null;
    },
  });

  function send(text: string) {
    try {
      client?.enqueue(encoder.encode(text));
    } catch {
      client = null;
    }
  }

  function finish(error?: Error) {
    try {
      if (error) client?.error(error);
      else client?.close();
    } catch {
      // Already closed/cancelled by a disconnect -- nothing left to tell.
    }
    client = null;
  }

  const generation = (async () => {
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
          fullText += chunk;
          send(chunk);
        }

        if (fullText) {
          const { error } = await supabase
            .from("scripts")
            .insert({ id: scriptId, user_id: user.id, prompt: message, content: fullText });
          if (error) console.error("generate-script: failed to save script", error);
        }
        finish();
        return;
      } catch (error) {
        console.error(`generate-script: ${candidate.label} failed`, error);

        if (fullText) {
          send("\n\n[Generation was interrupted due to an error. Please try again.]");
          finish();
          return;
        }
        // Nothing streamed yet — safe to fall through and try the next model.
      }
    }

    // No candidate produced any output at all -- no value was delivered,
    // so refund the charge made above before erroring.
    await refundUser(user.id, TOOL_CREDIT_COSTS.script.generation, "Script Generation refund", "script.generation");
    finish(new Error("All script-generation models are currently unavailable."));
  })();

  // Keeps the invocation alive (up to maxDuration) until the script is saved,
  // even once the response has ended early because the client went away.
  after(() => generation);

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export const POST = withApiLogging("/api/generate-script", handlePOST);
