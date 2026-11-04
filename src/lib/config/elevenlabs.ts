// ElevenLabs text-to-speech, served through fal.ai's ElevenLabs endpoints
// (https://fal.ai/explore/elevenlabs). Shared by the Voiceover Generator UI
// and the server routes.
//
// Moved off Replicate (2026-11-03): Replicate's elevenlabs/* models only
// accept an enum of 26 voice names, while fal's accept any ElevenLabs voice
// id -- the default voices below, any public Voice Library voice, or one a
// user pastes in. Verified live: a library voice id works on all five fal
// endpoints below, and an unknown id is rejected ("Voice not found: ...")
// rather than silently swapped for a default voice. Input schemas per
// https://fal.ai/models/<endpoint>/llms.txt -- they differ per model, hence
// the capability flags.

export interface ElevenLabsModel {
  id: string;
  /** fal endpoint id, POSTed to https://fal.run/<falEndpoint>. */
  falEndpoint: string;
  name: string;
  description: string;
  /** Max input characters per request (ElevenLabs' own per-model limit). */
  maxChars: number;
  /** Price relative to Multilingual v2 ($0.10 / 1k chars on fal). */
  costMultiplier: number;
  /** Inline audio tags like [excited] or [whispers]. */
  audioTags: boolean;
  /** Only three stability values (Creative / Natural / Robust). */
  discreteStability: boolean;
  /** False for models that detect the language themselves. */
  languageSelection: boolean;
  /** previous_text / next_text, for prosody continuity between segments. */
  requestStitching: boolean;
  similarity: boolean;
  style: boolean;
  speed: boolean;
}

export interface ElevenLabsVoice {
  /** ElevenLabs voice id, sent verbatim as fal's `voice`. */
  voiceId: string;
  name: string;
  gender: "male" | "female" | null;
  accent: string | null;
  /** "young", "middle aged" or "old" -- ElevenLabs' own label. */
  age: string | null;
  /** ElevenLabs' tagline for the voice ("Calm, Clear and Informative"), or "" if it has none. */
  description: string;
  /** Static sample clip -- bundled for default voices, ElevenLabs' CDN for library ones. */
  previewUrl: string | null;
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

export interface VoiceSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
}

export const ELEVENLABS_MODELS: ElevenLabsModel[] = [
  {
    id: "eleven_v4",
    falEndpoint: "elevenlabs/tts/eleven-v4",
    name: "Eleven v4",
    description: "ElevenLabs' most expressive model, directed with audio tags like [whispers] or [laughs]. 90+ languages.",
    maxChars: 5000,
    costMultiplier: 0.8,
    audioTags: true,
    discreteStability: false,
    languageSelection: true,
    requestStitching: false,
    similarity: true,
    style: false,
    speed: false,
  },
  {
    id: "eleven_v4_turbo",
    falEndpoint: "elevenlabs/tts/eleven-v4-turbo",
    name: "Eleven v4 Turbo",
    description: "The same v4 voices and audio tags at lower latency and half the price.",
    maxChars: 5000,
    costMultiplier: 0.4,
    audioTags: true,
    discreteStability: false,
    languageSelection: true,
    requestStitching: false,
    similarity: true,
    style: false,
    speed: false,
  },
  {
    id: "eleven_v3",
    falEndpoint: "fal-ai/elevenlabs/tts/eleven-v3",
    name: "Eleven v3",
    description: "Expressive model with audio tags like [excited], [whispers] or [sighs]. 70+ languages.",
    maxChars: 5000,
    costMultiplier: 1,
    audioTags: true,
    discreteStability: true,
    languageSelection: true,
    requestStitching: false,
    similarity: false,
    style: false,
    speed: false,
  },
  {
    id: "eleven_multilingual_v2",
    falEndpoint: "fal-ai/elevenlabs/tts/multilingual-v2",
    name: "Eleven Multilingual v2",
    description: "Lifelike, consistent quality for long-form narration. 29 languages.",
    maxChars: 10000,
    costMultiplier: 1,
    audioTags: false,
    discreteStability: false,
    languageSelection: false,
    requestStitching: true,
    similarity: true,
    style: true,
    speed: true,
  },
  {
    id: "eleven_turbo_v2_5",
    falEndpoint: "fal-ai/elevenlabs/tts/turbo-v2.5",
    name: "Eleven Turbo v2.5",
    description: "Fast, high-quality model at half the price. 32 languages.",
    maxChars: 40000,
    costMultiplier: 0.5,
    audioTags: false,
    discreteStability: false,
    languageSelection: true,
    requestStitching: true,
    similarity: true,
    style: true,
    speed: true,
  },
];

export const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

// Models dropped in a provider move, mapped to their closest replacement so
// rows saved on them still load (and can still add/regenerate segments).
// fal has no Flash v2.5; Turbo v2.5 is the same price tier.
const LEGACY_MODEL_IDS: Record<string, string> = {
  eleven_flash_v2_5: "eleven_turbo_v2_5",
};

export function getModel(id: string): ElevenLabsModel | undefined {
  return ELEVENLABS_MODELS.find((m) => m.id === (LEGACY_MODEL_IDS[id] ?? id));
}

// ElevenLabs' current default ("premade") voices, from the public
// GET https://api.elevenlabs.io/v1/voices (2026-11-03). Every other voice --
// the public Voice Library, or an id pasted in -- is looked up at runtime
// (see src/lib/server/elevenlabs-voices.ts). Preview clips are ElevenLabs'
// own samples, bundled by scripts/download-voice-previews.mjs.
function defaultVoice(
  voiceId: string,
  name: string,
  gender: ElevenLabsVoice["gender"],
  accent: string,
  age: string,
  description: string
): ElevenLabsVoice {
  return { voiceId, name, gender, accent, age, description, previewUrl: `/voice-previews/${voiceId}.mp3` };
}

export const VOICES: ElevenLabsVoice[] = [
  defaultVoice("EXAVITQu4vr4xnSDxMaL", "Sarah", "female", "American", "young", "Mature, Reassuring, Confident"),
  defaultVoice("nPczCjzI2devNBz1zQrb", "Brian", "male", "American", "middle aged", "Deep, Resonant and Comforting"),
  defaultVoice("JBFqnCBsd6RMkjVDRZzb", "George", "male", "British", "middle aged", "Warm, Captivating Storyteller"),
  defaultVoice("pNInz6obpgDQGcFmaJgB", "Adam", "male", "American", "middle aged", "Dominant, Firm"),
  defaultVoice("TX3LPaxmHKxFdv7VOQHJ", "Liam", "male", "American", "young", "Energetic, Social Media Creator"),
  defaultVoice("FGY2WhTYpPnrIDTdsKH5", "Laura", "female", "American", "young", "Enthusiast, Quirky Attitude"),
  defaultVoice("CwhRBWXzGAHq8TQ4Fs17", "Roger", "male", "American", "middle aged", "Laid-Back, Casual, Resonant"),
  defaultVoice("cgSgspJ2msm6clMCkdW9", "Jessica", "female", "American", "young", "Playful, Bright, Warm"),
  defaultVoice("onwK4e9ZLuTAKqWW03F9", "Daniel", "male", "British", "middle aged", "Steady Broadcaster"),
  defaultVoice("Xb7hH8MSUJpSbSDYk0k2", "Alice", "female", "British", "middle aged", "Clear, Engaging Educator"),
  defaultVoice("IKne3meq5aSn9XLyUdCD", "Charlie", "male", "Australian", "young", "Deep, Confident, Energetic"),
  defaultVoice("XrExE9yKIg1WjnnlVkGX", "Matilda", "female", "American", "middle aged", "Knowledgeable, Professional"),
  defaultVoice("cjVigY5qzO86Huf0OWal", "Eric", "male", "American", "middle aged", "Smooth, Trustworthy"),
  defaultVoice("hpp4J3VqNfWAUOO0d1Us", "Bella", "female", "American", "middle aged", "Professional, Bright, Warm"),
  defaultVoice("iP95p4xoKVk53GoZ742B", "Chris", "male", "American", "middle aged", "Charming, Down-to-Earth"),
  defaultVoice("pFZP5JQG7iQjIQuC4Bku", "Lily", "female", "British", "middle aged", "Velvety Actress"),
  defaultVoice("bIHbv24MWmeRgasZH58o", "Will", "male", "American", "young", "Relaxed Optimist"),
  defaultVoice("SAz9YHcvj6GT2YYXdXww", "River", null, "American", "middle aged", "Relaxed, Neutral, Informative"),
  defaultVoice("N2lVS1w4EtoT3dr4eOWO", "Callum", "male", "American", "middle aged", "Husky Trickster"),
  defaultVoice("SOYHLrjzK2X1ezoPC6cr", "Harry", "male", "American", "young", "Fierce Warrior"),
  defaultVoice("pqHfZKP75CvOlQylNhV4", "Bill", "male", "American", "old", "Wise, Mature, Balanced"),
];

export const DEFAULT_VOICE = VOICES[0];

export function getVoice(voiceId: string): ElevenLabsVoice | undefined {
  return VOICES.find((v) => v.voiceId === voiceId);
}

/** "Sarah - Mature, Reassuring, Confident", the way ElevenLabs names its voices. */
export function voiceTitle(voice: ElevenLabsVoice): string {
  return voice.description ? `${voice.name} - ${voice.description}` : voice.name;
}

/** "female · american · young" -- falls back to "ElevenLabs voice" when nothing is known. */
export function voiceMeta(voice: ElevenLabsVoice): string {
  const parts = [voice.gender, voice.accent, voice.age].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ").toLowerCase() : "ElevenLabs voice";
}

// ElevenLabs voice ids are 20 alphanumeric characters.
const VOICE_ID_PATTERN = /^[A-Za-z0-9]{20}$/;

export function isElevenLabsVoiceId(value: string): boolean {
  return VOICE_ID_PATTERN.test(value);
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
  return getModel(modelId)?.languageSelection ?? false;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  speed: 1,
};

export const SPEED_MIN = 0.7;
export const SPEED_MAX = 1.2;

export function hasDiscreteStability(modelId: string): boolean {
  return getModel(modelId)?.discreteStability ?? false;
}
export const DISCRETE_STABILITY_OPTIONS = [
  { value: 0, label: "Creative" },
  { value: 0.5, label: "Natural" },
  { value: 1, label: "Robust" },
] as const;

export function supportsRequestStitching(modelId: string): boolean {
  return getModel(modelId)?.requestStitching ?? false;
}

export function supportsAudioTags(modelId: string): boolean {
  return getModel(modelId)?.audioTags ?? false;
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
  const requestedModelId = typeof input.modelId === "string" ? input.modelId : DEFAULT_MODEL_ID;
  const modelId = getModel(requestedModelId)?.id;
  if (!modelId) return "modelId must be a supported ElevenLabs model";

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
