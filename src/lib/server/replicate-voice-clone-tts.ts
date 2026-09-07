// Text-to-speech for one cloned voice via Replicate's minimax/speech-02-turbo
// (https://replicate.com/minimax/speech-02-turbo), using the `voice_id`
// returned by replicate-voice-clone.ts's createVoiceClone() -- the model's
// own `voice_id` input schema documents accepting exactly that: "a voice_id
// returned by https://replicate.com/minimax/voice-cloning". Mirrors
// replicate-tts.ts's GeneratedSpeech shape so voice-resolution.ts can treat
// a catalog (Gemini) voice and a cloned (MiniMax) voice identically once
// resolved.
import { getReplicateClient, resolveOutputUrl, withReplicateRetry } from "./replicate-client";

const MODEL = "minimax/speech-02-turbo";

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

export async function generateSpeechForClonedVoice(voiceId: string, text: string): Promise<GeneratedSpeech> {
  if (!text.trim()) {
    throw new ReplicateClonedTtsError("text is required");
  }

  const replicate = getReplicateClient();

  let output: unknown;
  try {
    output = await withReplicateRetry(() => replicate.run(MODEL, { input: { text, voice_id: voiceId }, signal: AbortSignal.timeout(90_000) }));
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
