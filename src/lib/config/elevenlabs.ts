// ElevenLabs text-to-speech, served through Replicate's official ElevenLabs
// models (https://replicate.com/elevenlabs). Shared by the Voiceover
// Generator UI and the server routes.
//
// Input schema confirmed live against
// https://api.replicate.com/v1/models/elevenlabs/{v3,v2-multilingual,turbo-v2.5,flash-v2.5}
// (2026-11-02) -- identical across all four: prompt, voice (enum of the 26
// names in VOICES below -- Replicate doesn't accept arbitrary ElevenLabs
// voice ids), stability 0-1, similarity_boost 0-1, style 0-1, speed 0.7-1.2,
// language_code, previous_text, next_text. Output is an audio file URI.

export interface ElevenLabsModel {
  id: string;
  /** Replicate model slug, passed to replicate.run(). */
  replicateModel: `${string}/${string}`;
  name: string;
  description: string;
  /** Max input characters per request (ElevenLabs' own per-model limit). */
  maxChars: number;
  /** Relative per-character price -- Flash/Turbo are half of Multilingual v2. */
  costMultiplier: number;
}

export interface ElevenLabsVoice {
  /** Replicate `voice` enum value, sent verbatim (also the display name). */
  voiceId: string;
  name: string;
  gender: "male" | "female" | null;
  accent: string | null;
  description: string;
}

export interface VoiceSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
}

/**
 * Everything stored per generation. Persisted as JSON in the existing
 * voiceover_generations.style_prompt column (see serializeTtsSettings) rather
 * than a new column, so this feature never depends on a migration having
 * been applied to whichever database a deploy is pointed at.
 */
export interface TtsSettings {
  modelId: string;
  /** ISO 639-1 code, or null for models that detect the language themselves. */
  languageCode: string | null;
  voiceSettings: VoiceSettings;
  voiceName: string;
}

export const ELEVENLABS_MODELS: ElevenLabsModel[] = [
  {
    id: "eleven_v3",
    replicateModel: "elevenlabs/v3",
    name: "Eleven v3",
    description: "Most expressive model, with audio tags like [excited], [whispers] or [sighs]. 70+ languages.",
    maxChars: 5000,
    costMultiplier: 1,
  },
  {
    id: "eleven_multilingual_v2",
    replicateModel: "elevenlabs/v2-multilingual",
    name: "Eleven Multilingual v2",
    description: "Lifelike, consistent quality for long-form narration. 29 languages.",
    maxChars: 10000,
    costMultiplier: 1,
  },
  {
    id: "eleven_turbo_v2_5",
    replicateModel: "elevenlabs/turbo-v2.5",
    name: "Eleven Turbo v2.5",
    description: "Fast, high-quality model at half the price. 32 languages.",
    maxChars: 40000,
    costMultiplier: 0.5,
  },
  {
    id: "eleven_flash_v2_5",
    replicateModel: "elevenlabs/flash-v2.5",
    name: "Eleven Flash v2.5",
    description: "Ultra-fast, low-cost model. 32 languages.",
    maxChars: 40000,
    costMultiplier: 0.5,
  },
];

export const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

export function getModel(id: string): ElevenLabsModel | undefined {
  return ELEVENLABS_MODELS.find((m) => m.id === id);
}

// The 26 voices Replicate's ElevenLabs models accept. Gender/accent are
// ElevenLabs' own labels for these default voices where known; null where
// we couldn't confirm one rather than guess.
export const VOICES: ElevenLabsVoice[] = [
  { voiceId: "Rachel", name: "Rachel", gender: "female", accent: "American", description: "Calm, clear narration" },
  { voiceId: "Drew", name: "Drew", gender: "male", accent: "American", description: "Well-rounded, steady delivery" },
  { voiceId: "Clyde", name: "Clyde", gender: "male", accent: "American", description: "Gruff, characterful voice" },
  { voiceId: "Paul", name: "Paul", gender: "male", accent: "American", description: "Authoritative, news-style reporting" },
  { voiceId: "Aria", name: "Aria", gender: "female", accent: "American", description: "Expressive, husky warmth" },
  { voiceId: "Domi", name: "Domi", gender: "female", accent: "American", description: "Strong, confident delivery" },
  { voiceId: "Dave", name: "Dave", gender: "male", accent: "British", description: "Conversational, casual" },
  { voiceId: "Roger", name: "Roger", gender: "male", accent: "American", description: "Confident, easy-going" },
  { voiceId: "Fin", name: "Fin", gender: "male", accent: "Irish", description: "Seasoned, characterful storyteller" },
  { voiceId: "Sarah", name: "Sarah", gender: "female", accent: "American", description: "Soft, reassuring" },
  { voiceId: "James", name: "James", gender: "male", accent: "Australian", description: "Calm, measured narration" },
  { voiceId: "Jane", name: "Jane", gender: "female", accent: "British", description: "Polished audiobook reader" },
  { voiceId: "Juniper", name: "Juniper", gender: "female", accent: "American", description: "Grounded, natural narration" },
  { voiceId: "Arabella", name: "Arabella", gender: "female", accent: null, description: "Mysterious, emotive storytelling" },
  { voiceId: "Hope", name: "Hope", gender: "female", accent: "American", description: "Upbeat, bright and friendly" },
  { voiceId: "Bradford", name: "Bradford", gender: "male", accent: "British", description: "Expressive adult storyteller" },
  { voiceId: "Reginald", name: "Reginald", gender: "male", accent: null, description: "Dark, intense character voice" },
  { voiceId: "Gaming", name: "Gaming", gender: null, accent: null, description: "High-energy gaming and hype content" },
  { voiceId: "Austin", name: "Austin", gender: "male", accent: "American", description: "Laid-back Southern drawl" },
  { voiceId: "Kuon", name: "Kuon", gender: "female", accent: null, description: "Cheerful, animated character voice" },
  { voiceId: "Blondie", name: "Blondie", gender: "female", accent: "British", description: "Warm, conversational" },
  { voiceId: "Priyanka", name: "Priyanka", gender: "female", accent: "Indian", description: "Warm, clear narration" },
  { voiceId: "Alexandra", name: "Alexandra", gender: "female", accent: "American", description: "Young, chatty and relatable" },
  { voiceId: "Monika", name: "Monika", gender: "female", accent: "Indian", description: "Smooth, natural delivery" },
  { voiceId: "Mark", name: "Mark", gender: "male", accent: "American", description: "Natural, relaxed conversations" },
  { voiceId: "Grimblewood", name: "Grimblewood", gender: "male", accent: "British", description: "Quirky, whimsical character voice" },
];

export const DEFAULT_VOICE = VOICES[0];

export function getVoice(voiceId: string): ElevenLabsVoice | undefined {
  return VOICES.find((v) => v.voiceId === voiceId);
}

// The languages ElevenLabs' v2.5 models support (ISO 639-1). v3 supports
// these and more; Multilingual v2 detects the language itself, so no
// language is sent for it.
export const LANGUAGES: { code: string; name: string }[] = [
  { code: "ar", name: "Arabic" },
  { code: "bg", name: "Bulgarian" },
  { code: "zh", name: "Chinese" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "en", name: "English" },
  { code: "fil", name: "Filipino" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "hi", name: "Hindi" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ms", name: "Malay" },
  { code: "no", name: "Norwegian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sk", name: "Slovak" },
  { code: "es", name: "Spanish" },
  { code: "sv", name: "Swedish" },
  { code: "ta", name: "Tamil" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "vi", name: "Vietnamese" },
];

export const DEFAULT_LANGUAGE_CODE = "en";

export function supportsLanguageSelection(modelId: string): boolean {
  return modelId !== "eleven_multilingual_v2";
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  speed: 1,
};

export const SPEED_MIN = 0.7;
export const SPEED_MAX = 1.2;

// Eleven v3 only accepts three stability values (Creative / Natural / Robust)
// and doesn't support request stitching (previous_text/next_text).
export function hasDiscreteStability(modelId: string): boolean {
  return modelId === "eleven_v3";
}
export const DISCRETE_STABILITY_OPTIONS = [
  { value: 0, label: "Creative" },
  { value: 0.5, label: "Natural" },
  { value: 1, label: "Robust" },
] as const;

export function supportsRequestStitching(modelId: string): boolean {
  return modelId !== "eleven_v3";
}

// Inline audio tags like [excited] or [whispers].
export function supportsAudioTags(modelId: string): boolean {
  return modelId === "eleven_v3";
}

export function nearestDiscreteStability(value: number): number {
  return DISCRETE_STABILITY_OPTIONS.reduce((best, o) => (Math.abs(o.value - value) < Math.abs(best - value) ? o.value : best), 0.5);
}

export function defaultTtsSettings(): TtsSettings {
  return {
    modelId: DEFAULT_MODEL_ID,
    languageCode: DEFAULT_LANGUAGE_CODE,
    voiceSettings: { ...DEFAULT_VOICE_SETTINGS },
    voiceName: DEFAULT_VOICE.name,
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/**
 * Coerces untrusted input (request body, a stored row) into valid settings,
 * dropping whatever the chosen model can't use. Returns an error string
 * instead when the model or language is unknown.
 */
export function parseTtsSettings(raw: unknown): TtsSettings | string {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const modelId = typeof input.modelId === "string" ? input.modelId : DEFAULT_MODEL_ID;
  if (!getModel(modelId)) return "modelId must be a supported ElevenLabs model";

  let languageCode: string | null = null;
  if (supportsLanguageSelection(modelId)) {
    languageCode = typeof input.languageCode === "string" && input.languageCode ? input.languageCode : DEFAULT_LANGUAGE_CODE;
    if (!LANGUAGES.some((l) => l.code === languageCode)) return "languageCode isn't a supported language";
  }

  const vs = (input.voiceSettings && typeof input.voiceSettings === "object" ? input.voiceSettings : {}) as Record<string, unknown>;
  let stability = clamp(vs.stability, 0, 1, DEFAULT_VOICE_SETTINGS.stability);
  if (hasDiscreteStability(modelId)) stability = nearestDiscreteStability(stability);

  const voiceSettings: VoiceSettings = {
    stability,
    similarityBoost: clamp(vs.similarityBoost, 0, 1, DEFAULT_VOICE_SETTINGS.similarityBoost),
    style: clamp(vs.style, 0, 1, DEFAULT_VOICE_SETTINGS.style),
    speed: clamp(vs.speed, SPEED_MIN, SPEED_MAX, DEFAULT_VOICE_SETTINGS.speed),
  };

  const voiceName = typeof input.voiceName === "string" && input.voiceName.trim() ? input.voiceName.trim().slice(0, 100) : "Voice";

  return { modelId, languageCode, voiceSettings, voiceName };
}

const STORED_SETTINGS_VERSION = 1;

/** The value written to voiceover_generations.style_prompt. */
export function serializeTtsSettings(settings: TtsSettings): string {
  return JSON.stringify({ v: STORED_SETTINGS_VERSION, ...settings });
}

/**
 * Reads settings back from a row's style_prompt. Returns null for rows made
 * before the ElevenLabs switch, whose style_prompt is a plain Gemini style
 * instruction ("Say the following.") and whose voice ids aren't ElevenLabs
 * voices.
 */
export function readStoredTtsSettings(stylePrompt: string | null | undefined): TtsSettings | null {
  if (!stylePrompt || !stylePrompt.startsWith("{")) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(stylePrompt);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || (raw as { v?: unknown }).v !== STORED_SETTINGS_VERSION) return null;
  const settings = parseTtsSettings(raw);
  return typeof settings === "string" ? null : settings;
}
