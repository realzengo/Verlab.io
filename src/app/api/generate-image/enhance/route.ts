import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { promptEnhanceModel } from "@/lib/server/openrouter-client";
import { isSafeFreeText } from "@/lib/validation";

const PROMPT_MAX = 4000;
const PURPOSES = ["character", "frame", "reference"] as const;
type Purpose = (typeof PURPOSES)[number];

const PURPOSE_GUIDANCE: Record<Purpose, string> = {
  character:
    "The image is a character reference for a video: exactly one person, facing the camera, framed from the thighs or waist up, with their face, hair and outfit clearly visible. Prefer natural light and a believable everyday setting unless the user asks otherwise.",
  frame:
    "The image is a single frame of a video: describe the shot (subject, action, setting, camera angle and framing, lighting, mood) so a video model can animate from it.",
  reference:
    "The image is a visual reference for a video: describe the subject, style, setting, palette and lighting clearly.",
};

function systemPrompt(purpose: Purpose): string {
  return [
    "You rewrite a user's rough image idea into one clear, detailed prompt for a photorealistic AI image model.",
    PURPOSE_GUIDANCE[purpose],
    "Keep every detail the user gave and never contradict it. Fill in only what's missing: appearance, clothing, pose, setting, lighting, camera feel.",
    "If the user names a real person, celebrity or brand, describe an original fictional equivalent instead of naming them.",
    "Reply with the prompt only: one paragraph, under 110 words, in the user's language, with no preamble, quotes, labels or markdown.",
  ].join(" ");
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`enhance-prompt:${user.id}`, 20, 60))) {
    return rateLimitedResponse();
  }

  let body: { prompt?: unknown; purpose?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, purpose = "reference" } = body;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "Write a prompt to enhance first." }, { status: 400 });
  }
  if (!isSafeFreeText(prompt, PROMPT_MAX)) {
    return NextResponse.json({ error: `prompt must be ${PROMPT_MAX} characters or fewer and contain no control characters or HTML tags` }, { status: 400 });
  }
  if (typeof purpose !== "string" || !(PURPOSES as readonly string[]).includes(purpose)) {
    return NextResponse.json({ error: "purpose must be one of the supported options" }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model: promptEnhanceModel,
      system: systemPrompt(purpose as Purpose),
      prompt: prompt.trim(),
      maxOutputTokens: 400,
      abortSignal: AbortSignal.timeout(25_000),
    });
    const enhanced = text
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .trim()
      .slice(0, PROMPT_MAX);
    if (!enhanced || !isSafeFreeText(enhanced, PROMPT_MAX)) {
      return NextResponse.json({ error: "Couldn't enhance that prompt. Try rewording it." }, { status: 502 });
    }
    return NextResponse.json({ prompt: enhanced });
  } catch (error) {
    return serverError("generate-image/enhance POST", error, "Couldn't enhance that prompt right now. Try again in a moment.");
  }
}

export const POST = withApiLogging("/api/generate-image/enhance", handlePOST);
