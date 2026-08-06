-- Provider migration: video_generations was built fal-only (fal_model_slug,
-- fal_request_id -- see 20260731150000_video_generations.sql). This adds
-- Replicate's equivalents ADDITIVELY, leaving the fal_* columns in place
-- rather than renaming/dropping them -- this table is live (Video Generator
-- already shipped before this migration), so existing rows must stay
-- readable exactly as they were written. New jobs are submitted with
-- replicate_prediction_id/replicate_model populated and fal_* left null;
-- old rows keep fal_* populated and replicate_* null. video-jobs.ts branches
-- on which pair is populated per row.
alter table public.video_generations
  add column replicate_prediction_id text,
  add column replicate_model text;

-- New rows populate replicate_model instead of fal_model_slug -- this
-- column's original NOT NULL constraint (20260731150000_video_generations.sql)
-- would otherwise reject every future insert. Existing rows keep whatever
-- value they already have.
alter table public.video_generations alter column fal_model_slug drop not null;

create index video_generations_replicate_prediction_id_idx on public.video_generations (replicate_prediction_id);
