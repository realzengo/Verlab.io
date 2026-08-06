// Text-to-speech via Replicate's google/gemini-3.1-flash-tts
// (https://replicate.com/google/gemini-3.1-flash-tts). Like
// minimax/speech-02-turbo before it, `replicate.run()` blocks until the
// prediction finishes internally, so this needs no separate submit/poll/
// webhook machinery for a short script chunk.
//
// Field names below (text, voice, prompt, language_code) are best-effort
// from the model's public Replicate page as of this writing -- verify
// against https://replicate.com/google/gemini-3.1-flash-tts/api before the
// first real deploy, same live-verification discipline fal-video.ts's own
// header comment used for falSlug.
//
// Unlike MiniMax, this model has NO numeric speed/stability/volume params at
// all -- it's steered entirely through a free-text `prompt` style
// instruction (e.g. "Say the following cheerfully"). The Speed/Stability
// sliders in the UI are translated into that instruction below rather than
// dropped, but there's no real "similarity to reference voice" concept on a
// preset-voice model like this one (that's an ElevenLabs-specific idea), so
// the Similarity slider was removed from the UI entirely rather than kept
// as a knob that silently does nothing.
import { getReplicateClient, resolveOutputUrl, withReplicateRetry } from "./replicate-client";

const MODEL = "google/gemini-3.1-flash-tts";

export class ReplicateTtsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplicateTtsError";
  }
}

export interface GenerateSpeechInput {
  text: string;
  voiceId: string;
  /** 0.5-2.0 UI slider -- translated into a "quickly"/"slowly" style instruction below, since this model has no numeric speed param. */
  speed: number;
  /** 0-100 UI slider -- translated into a "calm and steady" vs. "expressive and dynamic" style instruction below, since this model has no numeric stability param. */
  stability: number;
}

export interface GeneratedSpeech {
  bytes: Uint8Array;
  contentType: string;
}

function buildStylePrompt(speed: number, stability: number): string {
  const parts: string[] = [];
  if (speed <= 0.75) parts.push("slowly");
  else if (speed >= 1.3) parts.push("quickly");

  if (stability >= 70) parts.push("in a calm, steady, consistent tone");
  else if (stability <= 30) parts.push("with expressive, dynamic variation");

  if (parts.length === 0) return "Say the following naturally.";
  return `Say the following ${parts.join(" and ")}.`;
}

function buildInput(input: GenerateSpeechInput): Record<string, unknown> {
  return {
    text: input.text,
    voice: input.voiceId,
    prompt: buildStylePrompt(input.speed, input.stability),
    language_code: "en-US",
  };
}

export async function generateSpeech(input: GenerateSpeechInput): Promise<GeneratedSpeech> {
  if (!input.text.trim()) {
    throw new ReplicateTtsError("text is required");
  }

  const replicate = getReplicateClient();

  let output: unknown;
  try {
    // Bounded -- without this, a hung or slow-cold-start Replicate call has
    // no ceiling and can leave the caller (e.g. the voice-preview button)
    // spinning indefinitely with no error ever surfaced. Wrapped in
    // withReplicateRetry since low-balance accounts get throttled to a
    // burst of 1 request/~6s -- see that function's own comment.
    output = await withReplicateRetry(() => replicate.run(MODEL, { input: buildInput(input), signal: AbortSignal.timeout(90_000) }));
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ReplicateTtsError("Replicate took too long to respond (timed out after 90s)");
    }
    throw new ReplicateTtsError(error instanceof Error ? error.message : "Replicate prediction failed");
  }

  const url = await resolveOutputUrl(output);

  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new ReplicateTtsError(`Failed to download generated audio (${response.status})`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "audio/mpeg";
  return { bytes, contentType };
}

// ~150 words/minute average speech rate, adjusted by the requested speed
// slider -- a placeholder shown immediately after generation, before the
// client has loaded the actual audio's metadata (see VoiceoverGenerator.tsx,
// which corrects this once the <audio> element reports its real duration).
// Purely cosmetic -- the model itself has no numeric speed param (see the
// module header), so this doesn't need to match its style-prompt behavior
// exactly, only give a reasonable initial timeline size.
export function estimateDurationSeconds(text: string, speed: number): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const speedMultiplier = speed <= 0.75 ? 0.8 : speed >= 1.3 ? 1.2 : 1;
  const wordsPerSecond = (150 / 60) * speedMultiplier;
  return Math.max(0.5, wordCount / wordsPerSecond);
}
