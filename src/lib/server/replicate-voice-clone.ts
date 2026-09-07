// Voice cloning via Replicate's minimax/voice-cloning
// (https://replicate.com/minimax/voice-cloning) -- clones a voice from one
// audio sample and returns a `voice_id` that plugs directly into
// minimax/speech-02-turbo's own `voice_id` input for every future generation
// (see replicate-voice-clone-tts.ts). No separate "delete voice" endpoint
// exists for a cloned MiniMax voice, so /api/voice-clones/[id]'s DELETE only
// removes our own DB row -- see that route's own comment.
//
// `voice_file` MUST be a URL whose path ends in a real audio extension
// (.wav/.mp3/.m4a) -- confirmed live the hard way: a bare `data:audio/wav;
// base64,...` URI, and even Replicate's own Files API upload (which returns
// an extensionless `.../v1/files/<id>` URL), both fail predictably with
// "invalid file ext for voice clone". The cog script downloads the URL and
// inspects the path suffix, not the payload's content-type -- a signed
// Storage URL with `.wav` before the `?token=` query string (see
// /api/voice-clones/route.ts's use of the voice-clone-uploads bucket) is
// what actually works.
import { getReplicateClient, withReplicateRetry } from "./replicate-client";

const CLONE_MODEL = "minimax/voice-cloning";

// Which MiniMax TTS model the clone is trained for -- must match the model
// replicate-voice-clone-tts.ts calls with the resulting voice_id.
const TARGET_SPEECH_MODEL = "speech-02-turbo";

export class ReplicateVoiceCloneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplicateVoiceCloneError";
  }
}

export interface VoiceCloneResult {
  voiceId: string;
}

/** `voiceFileUrl` must be fetchable by Replicate and end in a real audio extension -- see the module comment above. */
export async function createVoiceClone(voiceFileUrl: string): Promise<VoiceCloneResult> {
  const replicate = getReplicateClient();

  let output: unknown;
  try {
    output = await withReplicateRetry(() =>
      replicate.run(CLONE_MODEL, {
        input: { voice_file: voiceFileUrl, model: TARGET_SPEECH_MODEL },
        signal: AbortSignal.timeout(120_000),
      })
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ReplicateVoiceCloneError("Replicate took too long to clone that voice (timed out after 120s)");
    }
    throw new ReplicateVoiceCloneError(error instanceof Error ? error.message : "Voice cloning failed");
  }

  const result = output as { voice_id?: string } | undefined;
  if (!result?.voice_id) {
    throw new ReplicateVoiceCloneError("Replicate did not return a voice_id");
  }

  return { voiceId: result.voice_id };
}
