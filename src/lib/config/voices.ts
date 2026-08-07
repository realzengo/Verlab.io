// Voice catalog for the Voiceover Generator -- backed by Replicate's
// google/gemini-3.1-flash-tts (https://replicate.com/google/gemini-3.1-flash-tts),
// which ships a fixed catalog of 30 named voices. Google's "Speech
// generation" docs give a one-word style descriptor per voice but no
// gender; `gender` here is sourced from Google Cloud's Chirp 3: HD voice
// table (docs.cloud.google.com/text-to-speech/docs/chirp3-hd), which lists
// the same 30 voice names with a published Male/Female label. `description`
// is our own one-line copy, not Google's.
// Live-verify voice_id spelling against the model page before adding more --
// same "don't trust, verify live" discipline video-models.ts uses for
// falSlug.

export interface VoiceOption {
  /** Gemini TTS `voice` enum value, sent verbatim. */
  id: string;
  /** Google's own one-word style descriptor for this voice. */
  style: string;
  /** Published Male/Female label (Google Cloud Chirp 3: HD voice table). */
  gender: "Male" | "Female";
  /** Our one-line description of the voice, shown in the picker. */
  description: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "Zephyr", style: "Bright", gender: "Female", description: "Bright, energetic voice great for upbeat content" },
  { id: "Puck", style: "Upbeat", gender: "Male", description: "Upbeat, playful voice perfect for short-form videos" },
  { id: "Charon", style: "Informative", gender: "Male", description: "Informative, steady voice ideal for explainers" },
  { id: "Kore", style: "Firm", gender: "Female", description: "Firm, confident voice suited for narration" },
  { id: "Fenrir", style: "Excitable", gender: "Male", description: "Excitable, high-energy voice for hype content" },
  { id: "Leda", style: "Youthful", gender: "Female", description: "Youthful, light voice great for casual content" },
  { id: "Orus", style: "Firm", gender: "Male", description: "Firm, authoritative voice for professional narration" },
  { id: "Aoede", style: "Breezy", gender: "Female", description: "Breezy, relaxed voice for laid-back storytelling" },
  { id: "Callirrhoe", style: "Easy-going", gender: "Female", description: "Easy-going, warm voice for conversational content" },
  { id: "Autonoe", style: "Bright", gender: "Female", description: "Bright, cheerful voice for lively narration" },
  { id: "Enceladus", style: "Breathy", gender: "Male", description: "Breathy, intimate voice for close narration" },
  { id: "Iapetus", style: "Clear", gender: "Male", description: "Clear, articulate voice for crisp narration" },
  { id: "Umbriel", style: "Easy-going", gender: "Male", description: "Easy-going, relaxed voice for natural delivery" },
  { id: "Algenib", style: "Gravelly", gender: "Male", description: "Gravelly, textured voice for gritty storytelling" },
  { id: "Despina", style: "Smooth", gender: "Female", description: "Smooth, polished voice for premium content" },
  { id: "Erinome", style: "Clear", gender: "Female", description: "Clear, precise voice for confident narration" },
  { id: "Algieba", style: "Smooth", gender: "Male", description: "Smooth, rich voice for premium narration" },
  { id: "Rasalgethi", style: "Informative", gender: "Male", description: "Informative, measured voice for explainers" },
  { id: "Laomedeia", style: "Upbeat", gender: "Female", description: "Upbeat, energetic voice for short-form content" },
  { id: "Achernar", style: "Soft", gender: "Female", description: "Soft, gentle voice for calm narration" },
  { id: "Alnilam", style: "Firm", gender: "Male", description: "Firm, grounded voice for confident delivery" },
  { id: "Schedar", style: "Even", gender: "Male", description: "Even, steady voice for balanced narration" },
  { id: "Gacrux", style: "Mature", gender: "Female", description: "Mature, grounded voice for authoritative content" },
  { id: "Pulcherrima", style: "Forward", gender: "Female", description: "Forward, assertive voice for bold delivery" },
  { id: "Achird", style: "Friendly", gender: "Male", description: "Friendly, approachable voice for casual content" },
  { id: "Zubenelgenubi", style: "Casual", gender: "Male", description: "Casual, natural voice for everyday narration" },
  { id: "Vindemiatrix", style: "Gentle", gender: "Female", description: "Gentle, soothing voice for calm content" },
  { id: "Sadachbia", style: "Lively", gender: "Male", description: "Lively, dynamic voice for energetic content" },
  { id: "Sadaltager", style: "Knowledgeable", gender: "Male", description: "Knowledgeable, confident voice for expert narration" },
  { id: "Sulafat", style: "Warm", gender: "Female", description: "Warm, inviting voice for friendly narration" },
];

export const DEFAULT_VOICE_ID = "Kore";

export function getVoiceOption(id: string): VoiceOption | undefined {
  return VOICE_OPTIONS.find((voice) => voice.id === id);
}

// Fixed sample line rendered once per voice and cached forever in the
// voice-previews bucket (see /api/voices/preview/route.ts) -- every user
// hears the exact same clip, so generating it per-voice (not per-user) is
// correct, not a shortcut.
export const VOICE_PREVIEW_TEXT = "Hi, this is a quick preview of how I sound. I hope you like it!";
