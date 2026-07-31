import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { OPENROUTER_MAX_OUTPUT_TOKENS, openrouterInstructModel } from "@/lib/server/openrouter-client";
import { withApiLogging } from "@/lib/server/api-logging";
import type { TranscriptLine } from "@/lib/types";

const TranslateSchema = z.object({
  lines: z.array(z.string()),
});

// Kept small: smaller batches are more likely to return exactly one
// translated line per input line — and thus pass the count check below —
// than asking for an entire transcript in one JSON array.
const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 2;

async function translateBatch(texts: string[], targetLanguage: string): Promise<string[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { object } = await generateObject({
        model: openrouterInstructModel,
        schema: TranslateSchema,
        maxOutputTokens: Math.min(8000, OPENROUTER_MAX_OUTPUT_TOKENS),
        system: `You translate short-form video caption lines into ${targetLanguage}. Return exactly one translated string per input line, in the same order, with no commentary. Keep translations concise and natural enough to read as on-screen captions.`,
        prompt: JSON.stringify(texts),
      });

      if (object.lines.length === texts.length) return object.lines;
      lastError = new Error(`Translation output did not match line count (expected ${texts.length}, got ${object.lines.length})`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Translation failed");
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { lines?: TranscriptLine[]; targetLanguage?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const lines = body.lines;
  const targetLanguage = body.targetLanguage?.trim();

  if (!lines?.length || !targetLanguage) {
    return NextResponse.json({ error: "lines and targetLanguage are required" }, { status: 400 });
  }

  try {
    const texts = lines.map((line) => line.text);
    const translatedTexts: string[] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      translatedTexts.push(...(await translateBatch(batch, targetLanguage)));
    }

    const translated: TranscriptLine[] = lines.map((line, i) => ({ ...line, text: translatedTexts[i] }));
    return NextResponse.json({ lines: translated });
  } catch (error) {
    console.error("[transcripts] translation failed:", error);
    return NextResponse.json({ error: "Translation failed. Try again." }, { status: 500 });
  }
}

export const POST = withApiLogging("/api/transcripts/translate", handlePOST);
