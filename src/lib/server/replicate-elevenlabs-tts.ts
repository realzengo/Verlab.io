// ElevenLabs text-to-speech via Replicate's official ElevenLabs models
// (elevenlabs/v3, v2-multilingual, turbo-v2.5, flash-v2.5 -- see
// src/lib/config/elevenlabs.ts for the confirmed input schema). Replaces the
// google/gemini-3.1-flash-tts integration. Like that one, `replicate.run()`
// blocks until the prediction finishes, so a short script chunk needs no
// separate submit/poll machinery.
import { getModel, supportsRequestStitching, type TtsSettings } from "@/lib/config/elevenlabs";
import { downloadReplicateAsset, getReplicateClient, resolveOutputUrl, withReplicateRetry } from "./replicate-client";

export class ElevenLabsTtsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElevenLabsTtsError";
  }
}

export interface GenerateSpeechInput {
  text: string;
  voiceId: string;
  settings: TtsSettings;
  /** Neighbouring segment text, for prosody continuity in line-by-line mode. */
  previousText?: string;
  nextText?: string;
}

export interface GeneratedSpeech {
  bytes: Uint8Array;
  contentType: string;
}

function buildInput(input: GenerateSpeechInput): Record<string, unknown> {
  const { settings } = input;
  const vs = settings.voiceSettings;
  const body: Record<string, unknown> = {
    prompt: input.text,
    voice: input.voiceId,
    stability: vs.stability,
    similarity_boost: vs.similarityBoost,
    style: vs.style,
    speed: vs.speed,
  };
  if (settings.languageCode) body.language_code = settings.languageCode;
  if (supportsRequestStitching(settings.modelId)) {
    if (input.previousText) body.previous_text = input.previousText;
    if (input.nextText) body.next_text = input.nextText;
  }
  return body;
}

export async function generateSpeech(input: GenerateSpeechInput): Promise<GeneratedSpeech> {
  if (!input.text.trim()) throw new ElevenLabsTtsError("text is required");
  const model = getModel(input.settings.modelId);
  if (!model) throw new ElevenLabsTtsError(`Unknown model ${input.settings.modelId}`);

  const replicate = getReplicateClient();
  let output: unknown;
  try {
    // Bounded, and retried for low-balance throttling -- see
    // withReplicateRetry's own comment.
    output = await withReplicateRetry(() => replicate.run(model.replicateModel, { input: buildInput(input), signal: AbortSignal.timeout(90_000) }));
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ElevenLabsTtsError("Replicate took too long to respond (timed out after 90s)");
    }
    throw new ElevenLabsTtsError(error instanceof Error ? error.message : "Replicate prediction failed");
  }

  const asset = await downloadReplicateAsset(await resolveOutputUrl(output), 60_000);
  return { bytes: asset.bytes, contentType: asset.contentType.startsWith("audio/") ? asset.contentType : "audio/mpeg" };
}

// ~150 words/minute -- a placeholder until the client reads the real audio
// duration (VoiceoverGenerator.tsx corrects it on loadedmetadata).
export function estimateDurationSeconds(text: string, speed = 1): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(0.5, wordCount / ((150 / 60) * speed));
}
