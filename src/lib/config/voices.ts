// Voice-cloning flags. The voice catalog itself now comes live from
// ElevenLabs (see src/lib/config/elevenlabs.ts and src/lib/server/elevenlabs.ts).

// Fixed sample line for voice previews -- rendered once per ElevenLabs voice
// and cached (/api/voices/preview), and per clone (/api/voice-clones/[id]/preview).
export const VOICE_PREVIEW_TEXT = "Hi, this is a quick preview of how I sound. I hope you like it!";

// Single kill switch for the "Add Your Voice" cloning feature (VoiceCloneModal
// / AddVoiceModal, the voice-clones API routes, and the "Your Voices" list in
// VoiceoverGenerator.tsx) -- flip to true once the voice_clones migration is
// live and the flow has been re-verified end to end. Checked both
// client-side (button stays disabled, no clone list fetched) and
// server-side in POST /api/voice-clones (a disabled client can't be trusted
// as the only gate).
export const VOICE_CLONING_ENABLED = false;
