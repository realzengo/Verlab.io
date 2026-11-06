-- Clipping: one row per long-form YouTube video a user turns into short clips.
--
-- Lifecycle (status): queued (credits charged, preparing audio) ->
-- transcribing (WhisperX prediction running on Replicate) -> finding (the
-- LLM is picking viral moments) -> ready | failed. The browser polls
-- GET /api/clips/[id], which advances transcribing -> finding -> ready.
--
-- The server writes every column with the service role, so users only get
-- read and delete on their own rows: letting them update would let them
-- rewind a failed row and collect its refund again.
create table public.clip_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  video_id text not null,
  title text not null,
  channel_title text,
  thumbnail_url text,
  duration_seconds integer not null check (duration_seconds > 0),
  status text not null default 'queued'
    check (status in ('queued', 'transcribing', 'finding', 'ready', 'failed')),
  -- What the user asked for: clip length, a topic to focus on (ClipOptions).
  options jsonb not null default '{}'::jsonb,
  credits_charged integer not null default 0,
  prediction_id text,
  -- The provider's direct (short-lived, streamed) video link the clip
  -- cutter reads from; refreshed when it goes stale.
  media_url text,
  language text,
  -- Word timings, [[start, end, "word"], ...] in seconds.
  transcript jsonb,
  -- Detected moments, see ClipMoment in src/lib/clips.ts.
  clips jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clip_projects enable row level security;

create policy "Users can view own clip projects"
  on public.clip_projects for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete own clip projects"
  on public.clip_projects for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger clip_projects_set_updated_at
  before update on public.clip_projects
  for each row
  execute function public.set_updated_at();

create index clip_projects_user_id_idx on public.clip_projects (user_id, created_at desc);

-- Finished clips, rendered in the browser and uploaded to the private
-- `clip-exports` bucket at <user_id>/<project_id>/<export_id>.mp4 through a
-- signed upload URL the server issues. Served back through signed URLs.
create table public.clip_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.clip_projects(id) on delete cascade,
  clip_id text not null,
  title text not null,
  storage_path text not null,
  aspect text not null check (aspect in ('9:16', '1:1', '16:9')),
  duration_seconds numeric not null check (duration_seconds > 0),
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

alter table public.clip_exports enable row level security;

create policy "Users can view own clip exports"
  on public.clip_exports for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete own clip exports"
  on public.clip_exports for delete to authenticated
  using ((select auth.uid()) = user_id);

create index clip_exports_project_id_idx on public.clip_exports (project_id, created_at desc);

-- 50MB matches the project-wide Storage upload cap; the renderer sizes its
-- bitrate to stay under it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clip-exports', 'clip-exports', false, 52428800, array['video/mp4'])
on conflict (id) do nothing;

-- App code only touches this bucket through the service role and signed
-- URLs; these are defense in depth, matching the other private buckets.
create policy "Users can view their own clip exports"
  on storage.objects for select to authenticated
  using (bucket_id = 'clip-exports' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "Users can upload their own clip exports"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'clip-exports' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "Users can delete their own clip exports"
  on storage.objects for delete to authenticated
  using (bucket_id = 'clip-exports' and (select auth.uid())::text = (storage.foldername(name))[1]);
