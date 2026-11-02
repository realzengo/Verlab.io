// Resolves a `voiceId` string into either an ElevenLabs preset voice (via
// Replicate's elevenlabs/* models) or a user's cloned voice
// (Replicate, via minimax/voice-cloning + minimax/speech-02-turbo), and
// generates speech through whichever provider owns it. The generate-voiceover
// routes (initial generation, add-segment, regenerate-segment) and the MCP
// tool all go through generateSpeechForVoice() so a cloned voice works
// everywhere an ElevenLabs voice does.
//
// Cloned voices are addressed as `clone:<voice_clones.id>` -- this string is
// what gets stored verbatim in voiceover_generations.voice_id, so a completed
// generation still resolves correctly even if the clone is later deleted
// (isValidVoiceId/lookupClone will just say no to *new* segments on it).
import { getVoice, type TtsSettings } from "@/lib/config/elevenlabs";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSpeech as generateElevenLabsSpeech, type GeneratedSpeech } from "./replicate-elevenlabs-tts";
import { generateSpeechForClonedVoice } from "./replicate-voice-clone-tts";

export const CLONE_VOICE_PREFIX = "clone:";

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

/** True if `voiceId` is either one of the preset ElevenLabs voices, or a clone owned by `userId`. */
export async function isValidVoiceId(voiceId: string, userId: string): Promise<boolean> {
  if (isClonedVoiceId(voiceId)) {
    return (await lookupClone(voiceId, userId)) !== null;
  }
  return Boolean(getVoice(voiceId));
}

export interface GenerateSpeechForVoiceInput {
  text: string;
  voiceId: string;
  settings: TtsSettings;
  previousText?: string;
  nextText?: string;
  userId: string;
}

export async function generateSpeechForVoice(input: GenerateSpeechForVoiceInput): Promise<GeneratedSpeech> {
  if (isClonedVoiceId(input.voiceId)) {
    const clonedVoiceId = await lookupClone(input.voiceId, input.userId);
    if (!clonedVoiceId) throw new Error("Voice not found");
    // ElevenLabs model/voice settings have no equivalent on
    // minimax/speech-02-turbo's schema, so they're unused here.
    return generateSpeechForClonedVoice(clonedVoiceId, input.text);
  }
  return generateElevenLabsSpeech(input);
}
