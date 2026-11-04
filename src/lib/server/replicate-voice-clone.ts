// Voice cloning via Replicate's minimax/voice-cloning
// (https://replicate.com/minimax/voice-cloning) -- clones a voice from one
// audio sample and returns a `voice_id` that plugs directly into the MiniMax
// speech model it was trained for (CLONE_SPEECH_MODEL, see
// replicate-voice-clone-tts.ts). No "delete voice" endpoint exists for a
// cloned MiniMax voice, so deleting a clone only removes our own record --
// see deleteClone() in voice-clones.ts.
//
// Input schema confirmed live against
// https://api.replicate.com/v1/models/minimax/voice-cloning (2026-11-03):
// voice_file, model (speech-2.6-turbo | speech-2.6-hd | speech-02-turbo |
// speech-02-hd), accuracy, need_noise_reduction, need_volume_normalization.
// Output: { voice_id, preview, model }.
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

// Which MiniMax speech model clones are trained for -- generation must use
// the same one (replicate-voice-clone-tts.ts reads it from the clone record).
export const CLONE_SPEECH_MODEL = "speech-2.6-turbo";

export class ReplicateVoiceCloneError extends Error {
  /** Safe to show the user as-is (a problem with their sample, not with us). */
  readonly userMessage: string | null;

  constructor(message: string, userMessage: string | null = null) {
    super(message);
    this.name = "ReplicateVoiceCloneError";
    this.userMessage = userMessage;
  }
}

export interface VoiceCloneResult {
  voiceId: string;
  model: string;
}

// MiniMax rejects bad samples with terse messages; these are the ones that
// are the sample's fault, worded for the person who uploaded it.
function sampleProblem(message: string): string | null {
  if (/duration|too short|too long|length/i.test(message)) return "Your sample must be between 10 seconds and 5 minutes long.";
  if (/file ext|format|decode|corrupt|invalid audio/i.test(message)) return "We couldn't read that audio file. Try a different MP3, WAV, or M4A.";
  if (/size|too large/i.test(message)) return "Your sample must be under 20MB.";
  if (/no.*(speech|voice)|silen|quality|noise/i.test(message)) return "We couldn't hear a clear voice in that sample. Try a cleaner recording of one person speaking.";
  return null;
}

/** `voiceFileUrl` must be fetchable by Replicate and end in a real audio extension -- see the module comment above. */
export async function createVoiceClone(voiceFileUrl: string, options: { noiseReduction: boolean }): Promise<VoiceCloneResult> {
  const replicate = getReplicateClient();

  let output: unknown;
  try {
    output = await withReplicateRetry(() =>
      replicate.run(CLONE_MODEL, {
        input: {
          voice_file: voiceFileUrl,
          model: CLONE_SPEECH_MODEL,
          need_noise_reduction: options.noiseReduction,
          need_volume_normalization: true,
        },
        signal: AbortSignal.timeout(120_000),
      })
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ReplicateVoiceCloneError("Replicate took too long to clone that voice (timed out after 120s)");
    }
    const message = error instanceof Error ? error.message : "Voice cloning failed";
    throw new ReplicateVoiceCloneError(message, sampleProblem(message));
  }

  const result = output as { voice_id?: string; model?: string } | undefined;
  if (!result?.voice_id) {
    throw new ReplicateVoiceCloneError("Replicate did not return a voice_id");
  }

  return { voiceId: result.voice_id, model: result.model || CLONE_SPEECH_MODEL };
}
