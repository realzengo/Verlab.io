// Voice-cloning settings, shared by the Clone a voice form and the
// voice-clones API routes. The ElevenLabs voice catalog lives in
// src/lib/config/elevenlabs.ts (defaults) and src/lib/server/elevenlabs-voices.ts
// (Voice Library search and voice id lookups).

// Fixed sample line for voice previews that we render ourselves: once per
// pasted ElevenLabs voice id without a sample of its own (/api/voices/lookup).
// Default and Voice Library voices use ElevenLabs' own sample clips instead,
// and a clone's preview is rendered once, from the text its owner typed.
export const VOICE_PREVIEW_TEXT = "Hi, this is a quick preview of how I sound. I hope you like it!";

// Single kill switch for voice cloning: the Clone a voice form, the Cloned
// tab's clone list, and every /api/voice-clones route. Checked on both sides
// (a disabled client can't be trusted as the only gate). Clones are stored in
// Storage, not the never-applied voice_clones table -- see
// src/lib/server/voice-clones.ts.
export const VOICE_CLONING_ENABLED = true;

export const MAX_VOICE_CLONES_PER_USER = 10;

// MiniMax's own limits for a cloning sample (minimax/voice-cloning on
// Replicate): MP3, M4A or WAV, 10 seconds to 5 minutes, under 20MB.
export const CLONE_SAMPLE_MAX_BYTES = 20 * 1024 * 1024;
export const CLONE_SAMPLE_MIN_SECONDS = 10;
export const CLONE_SAMPLE_MAX_SECONDS = 5 * 60;
/** Browser MIME type -> the extension MiniMax needs to see on the sample's URL. */
export const CLONE_SAMPLE_TYPES: Record<string, "mp3" | "m4a" | "wav"> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mpeg3": "mp3",
  "audio/x-mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/vnd.wave": "wav",
};
/** Fallback when the browser reports no (or a generic) MIME type. */
export const CLONE_SAMPLE_EXTENSIONS: Record<string, "mp3" | "m4a" | "wav"> = {
  mp3: "mp3",
  mpeg: "mp3",
  mpga: "mp3",
  m4a: "m4a",
  mp4: "m4a",
  wav: "wav",
  wave: "wav",
};

export const CLONE_PREVIEW_TEXT_MAX = 200;
export const CLONE_DEFAULT_PREVIEW_TEXT = "Hello, this is my cloned voice.";

// Recorded with each clone, so we can show what the owner agreed to.
export const CLONE_CONSENT_TEXT = "I own this voice or have explicit permission to clone and use it.";

// The languages MiniMax's speech-2.6-turbo can be told to favour
// (`language_boost`). Stored on the clone and sent with every generation in
// that voice; "Automatic" lets MiniMax detect it from the script.
export const CLONE_LANGUAGES = [
  "Automatic",
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Polish",
  "Russian",
  "Ukrainian",
  "Turkish",
  "Arabic",
  "Hindi",
  "Indonesian",
  "Vietnamese",
  "Thai",
  "Japanese",
  "Korean",
  "Chinese",
  "Cantonese",
  "Romanian",
  "Greek",
  "Czech",
  "Finnish",
  "Swedish",
  "Danish",
  "Norwegian",
  "Hungarian",
  "Bulgarian",
  "Croatian",
  "Slovak",
  "Slovenian",
  "Hebrew",
  "Persian",
  "Malay",
  "Filipino",
  "Tamil",
  "Catalan",
  "Afrikaans",
] as const;
export type CloneLanguage = (typeof CLONE_LANGUAGES)[number];
export const CLONE_DEFAULT_LANGUAGE: CloneLanguage = "English";

export type CloneGender = "male" | "female";

/** What the client sees of a clone -- never MiniMax's own voice id. */
export interface VoiceCloneSummary {
  id: string;
  name: string;
  language: CloneLanguage;
  gender: CloneGender;
  hasPreview: boolean;
  createdAt: string;
}
