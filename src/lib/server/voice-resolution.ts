// Resolves a `voiceId` string into either a fixed catalog voice (Gemini, via
// Replicate's google/gemini-3.1-flash-tts) or a user's cloned voice (also
// Replicate, via minimax/voice-cloning + minimax/speech-02-turbo), and
// generates speech through whichever model owns it. The three
// generate-voiceover routes (initial generation, add-segment,
// regenerate-segment) all go through generateSpeechForVoice() instead of
// calling replicate-tts's generateSpeech directly, so a cloned voice works
// everywhere a catalog voice does without those routes needing to know which
// underlying model is behind it.
//
// Cloned voices are addressed as `clone:<voice_clones.id>` (a plain uuid
// would collide with nothing in the catalog today, but the prefix keeps
// that true by construction rather than by accident) -- this string is what
// gets stored verbatim in voiceover_generations.voice_id, so a completed
// generation still resolves correctly even if the clone is later deleted
// (isValidVoiceId/lookupClone will just say no to *new* segments on it).
import { getVoiceOption } from "@/lib/config/voices";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSpeech as generateCatalogSpeech, type GenerateSpeechInput } from "./replicate-tts";
import { generateSpeechForClonedVoice } from "./replicate-voice-clone-tts";

export const CLONE_VOICE_PREFIX = "clone:";

export interface GeneratedSpeech {
  bytes: Uint8Array;
  contentType: string;
}

export function isClonedVoiceId(voiceId: string): boolean {
  return voiceId.startsWith(CLONE_VOICE_PREFIX);
}

async function lookupClone(voiceId: string, userId: string): Promise<string | null> {
  const cloneId = voiceId.slice(CLONE_VOICE_PREFIX.length);
  if (!cloneId) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("voice_clones").select("voice_id").eq("id", cloneId).eq("user_id", userId).maybeSingle();
  return data?.voice_id ?? null;
}

/** True if `voiceId` is either a real catalog id, or a clone owned by `userId`. */
export async function isValidVoiceId(voiceId: string, userId: string): Promise<boolean> {
  if (isClonedVoiceId(voiceId)) {
    return (await lookupClone(voiceId, userId)) !== null;
  }
  return Boolean(getVoiceOption(voiceId));
}

export async function generateSpeechForVoice(input: GenerateSpeechInput & { userId: string }): Promise<GeneratedSpeech> {
  if (isClonedVoiceId(input.voiceId)) {
    const clonedVoiceId = await lookupClone(input.voiceId, input.userId);
    if (!clonedVoiceId) throw new Error("Voice not found");
    // stylePrompt/languageCode are Gemini-specific inputs (free-text style
    // instruction, TTS language enum) with no equivalent on
    // minimax/speech-02-turbo's schema, so they're silently unused here --
    // same tradeoff noted where this dispatch used to hit ElevenLabs.
    return generateSpeechForClonedVoice(clonedVoiceId, input.text);
  }
  return generateCatalogSpeech(input);
}
