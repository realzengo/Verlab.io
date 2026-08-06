// Voice catalog for the Voiceover Generator -- backed by Replicate's
// google/gemini-3.1-flash-tts (https://replicate.com/google/gemini-3.1-flash-tts),
// which ships a fixed catalog of 30 named voices (Google's own "Speech
// generation" docs list these by tone/style, not gender -- unlike
// ElevenLabs/MiniMax there's no per-voice male/female label to surface here,
// so this catalog deliberately has no gender field or Male/Female filter).
// Live-verify voice_id spelling against the model page before adding more --
// same "don't trust, verify live" discipline video-models.ts uses for
// falSlug.

export interface VoiceOption {
  /** Gemini TTS `voice` enum value, sent verbatim. */
  id: string;
  /** Google's own one-word style descriptor for this voice. */
  style: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "Zephyr", style: "Bright" },
  { id: "Puck", style: "Upbeat" },
  { id: "Charon", style: "Informative" },
  { id: "Kore", style: "Firm" },
  { id: "Fenrir", style: "Excitable" },
  { id: "Leda", style: "Youthful" },
  { id: "Orus", style: "Firm" },
  { id: "Aoede", style: "Breezy" },
  { id: "Callirrhoe", style: "Easy-going" },
  { id: "Autonoe", style: "Bright" },
  { id: "Enceladus", style: "Breathy" },
  { id: "Iapetus", style: "Clear" },
  { id: "Umbriel", style: "Easy-going" },
  { id: "Algenib", style: "Gravelly" },
  { id: "Despina", style: "Smooth" },
  { id: "Erinome", style: "Clear" },
  { id: "Algieba", style: "Smooth" },
  { id: "Rasalgethi", style: "Informative" },
  { id: "Laomedeia", style: "Upbeat" },
  { id: "Achernar", style: "Soft" },
  { id: "Alnilam", style: "Firm" },
  { id: "Schedar", style: "Even" },
  { id: "Gacrux", style: "Mature" },
  { id: "Pulcherrima", style: "Forward" },
  { id: "Achird", style: "Friendly" },
  { id: "Zubenelgenubi", style: "Casual" },
  { id: "Vindemiatrix", style: "Gentle" },
  { id: "Sadachbia", style: "Lively" },
  { id: "Sadaltager", style: "Knowledgeable" },
  { id: "Sulafat", style: "Warm" },
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
