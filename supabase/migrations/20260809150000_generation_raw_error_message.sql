-- error_message on video_generations / image_generations / voiceover_generations
-- used to hold whatever the provider (Replicate, etc.) threw verbatim --
-- things like "Missing REPLICATE_API_TOKEN" or moderation codes -- and the
-- generator UIs render that column directly on failed cards, so raw
-- infra/provider detail was leaking straight to end users.
--
-- raw_error_message is the new home for that detail: written alongside a
-- generic error_message going forward (see src/lib/server/generation-error.ts),
-- selected only by admin queries, never by the user-facing list endpoints.
alter table video_generations add column if not exists raw_error_message text;
alter table image_generations add column if not exists raw_error_message text;
alter table voiceover_generations add column if not exists raw_error_message text;
