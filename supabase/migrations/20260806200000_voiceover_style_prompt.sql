-- Replaces the numeric speed/stability columns on voiceover_generations with
-- the fields that actually exist on Replicate's google/gemini-3.1-flash-tts
-- (confirmed live against https://api.replicate.com/v1/models/google/gemini-3.1-flash-tts):
-- the model has no numeric speed/stability input at all, only a free-text
-- `prompt` style instruction and a `language_code` enum. speed/stability were
-- a UI-only ElevenLabs-shaped approximation translated into that prompt (see
-- the removed buildStylePrompt() in src/lib/server/replicate-tts.ts) --
-- style_prompt now stores that instruction directly, and language_code
-- (previously hardcoded to "en-US" server-side) is user-selectable.
alter table public.voiceover_generations
  add column style_prompt text not null default 'Say the following.',
  add column language_code text not null default 'en-US';

alter table public.voiceover_generations
  drop column speed,
  drop column stability;
