// Text-to-speech for one cloned voice via Replicate's MiniMax speech models
// (https://replicate.com/minimax/speech-2.6-turbo), using the `voice_id`
// returned by replicate-voice-clone.ts's createVoiceClone() -- the models'
// own `voice_id` input documents accepting exactly that: "a voice_id
// returned by https://replicate.com/minimax/voice-cloning". A clone only
// works with the speech model it was trained for, so the caller passes the
// clone record's `model`. Same GeneratedSpeech shape as
// fal-elevenlabs-tts.ts, so voice-resolution.ts treats both alike.
import { getReplicateClient, resolveOutputUrl, withReplicateRetry } from "./replicate-client";

// speech-02-turbo is what clones were trained for before 2026-11-03.
const SPEECH_MODELS = new Set(["speech-2.6-turbo", "speech-2.6-hd", "speech-02-turbo", "speech-02-hd"]);

export class ReplicateClonedTtsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplicateClonedTtsError";
  }
}

export interface GeneratedSpeech {
  bytes: Uint8Array;
  contentType: string;
}

export interface ClonedSpeechOptions {
  /** MiniMax speech model the clone was trained for, e.g. "speech-2.6-turbo". */
  model: string;
  /** MiniMax `language_boost` ("English", "Automatic", ...). */
  language: string;
}

export async function generateSpeechForClonedVoice(voiceId: string, text: string, options: ClonedSpeechOptions): Promise<GeneratedSpeech> {
  if (!text.trim()) {
    throw new ReplicateClonedTtsError("text is required");
  }
  const model = SPEECH_MODELS.has(options.model) ? options.model : "speech-2.6-turbo";

  const replicate = getReplicateClient();

  let output: unknown;
  try {
    output = await withReplicateRetry(() =>
      replicate.run(`minimax/${model}`, {
        input: { text, voice_id: voiceId, language_boost: options.language, english_normalization: options.language === "English" },
        signal: AbortSignal.timeout(90_000),
      })
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ReplicateClonedTtsError("Replicate took too long to respond (timed out after 90s)");
    }
    throw new ReplicateClonedTtsError(error instanceof Error ? error.message : "Replicate prediction failed");
  }

  const url = await resolveOutputUrl(output);
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new ReplicateClonedTtsError(`Failed to download generated audio (${response.status})`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "audio/mpeg";
  return { bytes, contentType };
}
