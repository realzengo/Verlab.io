-- Video generator (Create / Edit / Motion) job table. Unlike
-- image_generations, this is built async-first from day one instead of
-- learning the lesson via a follow-up migration (see
-- 20260721120001_image_generations_status.sql /
-- 20260721130001_image_generations_update_policy.sql): fal's video models
-- are queue-based, not synchronous, and renders regularly run minutes long,
-- so every row is written by a background process (a fal webhook or the
-- cron reconciliation sweep) that needs RLS UPDATE access to its own rows
-- from the very first deploy.
--
-- One table covers all three modes (rather than three separate tables) so
-- the "My Videos" library, credit charges, and admin usage stay a single
-- source of truth -- `mode`/`operation` discriminate what actually ran.
create table public.video_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  mode text not null check (mode in ('create', 'edit', 'motion')),
  operation text not null check (
    operation in ('text_to_video', 'image_to_video', 'upscale', 'reframe', 'extend', 'motion_transfer')
  ),

  model text not null, -- display name, e.g. "Kling 2.5 Turbo Pro"
  fal_model_slug text not null,
  prompt text, -- nullable: Edit/Motion operations may have no prompt

  -- Per-model knobs (duration, aspect_ratio, resolution, sound_enabled,
  -- outputs, reference-motion preset, ...) live here instead of as columns
  -- so the schema doesn't need a migration every time a model adds a knob
  -- -- same rationale as image_generations.images being jsonb.
  params jsonb not null default '{}'::jsonb,

  -- Storage paths (videos bucket, see 20260731150001_videos_bucket.sql),
  -- not public URLs -- playback is always brokered through
  -- /api/library/video/[id] so a signed URL can be minted per request.
  source_video_path text, -- Edit/Motion input, or Create's end-frame source video (n/a today, reserved)
  source_image_path text, -- Create's start/end frame, or Motion's driven character image
  output_video_path text,
  thumbnail_path text,

  fal_request_id text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  error_message text,

  -- The cost quoted (and balance-checked) synchronously at submit time --
  -- charged verbatim on completion rather than recomputed then, so a
  -- pricing-table deploy that lands while a multi-minute render is in
  -- flight can never change what the user is actually charged for a job
  -- they already agreed to the price of.
  credits_quoted integer not null,
  -- Set exactly once, when the webhook/cron handler actually charges the
  -- user -- lets that handler check "have I already charged this row?"
  -- before deducting again if fal ever redelivers the same webhook.
  credits_charged integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.video_generations enable row level security;

create policy "Users can view own video generations"
  on public.video_generations for select
  using (auth.uid() = user_id);

create policy "Users can create own video generations"
  on public.video_generations for insert
  with check (auth.uid() = user_id);

-- Required from day one -- see the header comment. Background handlers use
-- the service-role client (bypasses RLS entirely) for the webhook/cron
-- paths, but the client-facing GET route's stale-row sweep runs as the
-- signed-in user and needs this to flip its own stuck rows to 'failed'.
create policy "Users can update own video generations"
  on public.video_generations for update
  using (auth.uid() = user_id);

create policy "Users can delete own video generations"
  on public.video_generations for delete
  using (auth.uid() = user_id);

create trigger video_generations_set_updated_at
  before update on public.video_generations
  for each row
  execute function public.set_updated_at();

create index video_generations_user_id_idx on public.video_generations (user_id, created_at desc);
-- Looked up by the webhook handler (fal sends the request id back, not our
-- row id) and by the cron sweep (find every row still in flight).
create index video_generations_fal_request_id_idx on public.video_generations (fal_request_id);
create index video_generations_status_idx on public.video_generations (status) where status in ('queued', 'processing');
