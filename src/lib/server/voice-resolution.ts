// Resolves a `voiceId` string into either an ElevenLabs voice (via fal's
// ElevenLabs endpoints -- a default voice, a Voice Library voice, or any id a
// user pasted in) or a user's cloned voice
// (Replicate, via minimax/voice-cloning + the MiniMax speech model it was
// trained for), and
// generates speech through whichever provider owns it. The generate-voiceover
// routes (initial generation, add-segment, regenerate-segment) and the MCP
// tool all go through generateSpeechForVoice() so a cloned voice works
// everywhere an ElevenLabs voice does.
//
// Cloned voices are addressed as `clone:<clone id>` (see voice-clones.ts) --
// this string is what gets stored verbatim in voiceover_generations.voice_id,
// so a completed generation still plays even if the clone is later deleted
// (isValidVoiceId/lookupClone will just say no to *new* segments on it).
import { isElevenLabsVoiceId, type TtsSettings } from "@/lib/config/elevenlabs";
import { generateSpeech as generateElevenLabsSpeech, type GeneratedSpeech } from "./fal-elevenlabs-tts";
import { generateSpeechForClonedVoice } from "./replicate-voice-clone-tts";
import { getClone, type VoiceCloneRecord } from "./voice-clones";

export const CLONE_VOICE_PREFIX = "clone:";

export function isClonedVoiceId(voiceId: string): boolean {
  return voiceId.startsWith(CLONE_VOICE_PREFIX);
}

async function lookupClone(voiceId: string, userId: string): Promise<VoiceCloneRecord | null> {
  return getClone(userId, voiceId.slice(CLONE_VOICE_PREFIX.length));
}

/**
 * True if `voiceId` is either shaped like an ElevenLabs voice id, or a clone
 * owned by `userId`. Whether an ElevenLabs id actually exists is only known
 * to fal -- the picker checks a pasted id up front (/api/voices/lookup), and
 * generation fails with "Voice not found" otherwise.
 */
export async function isValidVoiceId(voiceId: string, userId: string): Promise<boolean> {
  if (isClonedVoiceId(voiceId)) {
    return (await lookupClone(voiceId, userId)) !== null;
  }
  return isElevenLabsVoiceId(voiceId);
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
    const clone = await lookupClone(input.voiceId, input.userId);
    if (!clone) throw new Error("Voice not found");
    // ElevenLabs model/voice settings have no equivalent in MiniMax's
    // speech schema, so they're unused here -- the clone's own language is.
    return generateSpeechForClonedVoice(clone.providerVoiceId, input.text, { model: clone.model, language: clone.language });
  }
  return generateElevenLabsSpeech(input);
}
