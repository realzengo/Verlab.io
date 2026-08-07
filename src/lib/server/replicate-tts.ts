// Text-to-speech via Replicate's google/gemini-3.1-flash-tts
// (https://replicate.com/google/gemini-3.1-flash-tts). Like
// minimax/speech-02-turbo before it, `replicate.run()` blocks until the
// prediction finishes internally, so this needs no separate submit/poll/
// webhook machinery for a short script chunk.
//
// Field names below (text, voice, prompt, language_code) are confirmed live
// against https://api.replicate.com/v1/models/google/gemini-3.1-flash-tts --
// that's the model's *complete* input schema, no numeric speed/stability/
// volume params exist at all. It's steered entirely through the free-text
// `prompt` style instruction (e.g. "Speak with excitement and energy") and
// `language_code`, both chosen directly by the user in the UI now (see
// VoiceoverGenerator.tsx's style presets) rather than reverse-engineered from
// ElevenLabs-shaped sliders.
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
  /** Free-text style instruction, sent verbatim as the model's `prompt` input. */
  stylePrompt: string;
  /** Gemini TTS `language_code` enum value (see src/lib/config/languages.ts), sent verbatim. */
  languageCode: string;
}

export interface GeneratedSpeech {
  bytes: Uint8Array;
  contentType: string;
}

function buildInput(input: GenerateSpeechInput): Record<string, unknown> {
  return {
    text: input.text,
    voice: input.voiceId,
    prompt: input.stylePrompt,
    language_code: input.languageCode,
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

// ~150 words/minute average speech rate -- a placeholder shown immediately
// after generation, before the client has loaded the actual audio's metadata
// (see VoiceoverGenerator.tsx, which corrects this once the <audio> element
// reports its real duration). Purely cosmetic, just needs to give a
// reasonable initial timeline size -- the model has no numeric speed param
// to make this precise against (see the module header).
export function estimateDurationSeconds(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const wordsPerSecond = 150 / 60;
  return Math.max(0.5, wordCount / wordsPerSecond);
}
