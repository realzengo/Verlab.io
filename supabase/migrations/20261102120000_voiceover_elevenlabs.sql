-- Voiceover Generator moves from Replicate's google/gemini-3.1-flash-tts to
-- Replicate's official ElevenLabs models (elevenlabs/v3, v2-multilingual,
-- turbo-v2.5, flash-v2.5). Those are steered by a model choice + numeric
-- voice settings (stability, similarity_boost, style, speed) and a language
-- code, so all of it lives in one jsonb column (shape: TtsSettings in
-- src/lib/config/elevenlabs.ts).
--
-- Rows with tts_settings = null were made with the old Gemini engine; their
-- audio still plays, but new segments can't be added to them (their voice
-- ids like "Kore" aren't ElevenLabs voices). style_prompt/language_code are
-- kept for those rows; new rows write language_code = 'auto' when the model
-- detects the language itself.
alter table public.voiceover_generations
  add column tts_settings jsonb;
