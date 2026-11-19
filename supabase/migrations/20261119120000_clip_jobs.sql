-- Clipping work that runs on the render worker (Railway, worker/), off the
-- request/response path: one row per job, claimed by workers through
-- claim_clip_job() below.
--
--   kind     source  (project) fetch the whole video once, extract audio
--            prepare (project) cut every clip, 540p preview proxies, face tracks
--            render  (clip)    the finished MP4, saved to the library
--   status   queued -> running -> done | failed | canceled
--
-- Idempotency: `dedupe_key` is unique among live jobs (anything not failed or
-- canceled), so asking twice for the same work returns the same job. A render's
-- key hashes its settings, the transcript and the renderer version; same key,
-- same output, no second encode. A worker holds a job through a lease
-- (`locked_until`) it renews while working; a crashed worker's job is claimed
-- again once the lease runs out, up to `max_attempts`.
--
-- Users can read their own jobs (progress in the app); every write goes
-- through the service role, like clip_projects.

create table public.clip_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.clip_projects(id) on delete cascade,
  clip_id text,
  kind text not null check (kind in ('source', 'prepare', 'render')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed', 'canceled')),
  stage text check (stage in ('waiting', 'fetching', 'tracking', 'encoding', 'uploading')),
  progress real not null default 0 check (progress >= 0 and progress <= 1),
  -- What to do: for a render, the clip's edit settings (ClipEditSettings).
  input jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  priority smallint not null default 0,
  attempts smallint not null default 0,
  max_attempts smallint not null default 3,
  run_after timestamptz not null default now(),
  locked_by text,
  locked_until timestamptz,
  output_path text,
  output_bytes bigint,
  export_id uuid references public.clip_exports(id) on delete set null,
  -- Which encoder made it ("webcodecs", later "nvenc"), and how long each step took (ms).
  encoder text,
  timings jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((kind = 'render') = (clip_id is not null))
);

alter table public.clip_jobs enable row level security;

create policy "Users can view own clip jobs"
  on public.clip_jobs for select to authenticated
  using ((select auth.uid()) = user_id);

create trigger clip_jobs_set_updated_at
  before update on public.clip_jobs
  for each row
  execute function public.set_updated_at();

create unique index clip_jobs_live_dedupe_key on public.clip_jobs (dedupe_key)
  where status not in ('failed', 'canceled');
create index clip_jobs_claim_idx on public.clip_jobs (priority desc, created_at)
  where status in ('queued', 'running');
create index clip_jobs_project_idx on public.clip_jobs (project_id, created_at desc);
create index clip_jobs_user_live_idx on public.clip_jobs (user_id, created_at desc)
  where status in ('queued', 'running');

-- Workers check in every 15s; the app sends renders to the worker only while
-- one has checked in within the last minute, and renders in the browser otherwise.
create table public.clip_workers (
  id text primary key,
  version text,
  concurrency integer,
  encoder text,
  chrome text,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- Service role only (no policies).
alter table public.clip_workers enable row level security;

-- A finished render's library row; unique, so a retried job can't save twice.
alter table public.clip_exports
  add column render_job_id uuid unique references public.clip_jobs(id) on delete set null;

-- Server renders read their inputs from the clip's folder too: the editor's
-- face track (binary) beside the MP4s (bottom videos for split screen).
update storage.buckets
set allowed_mime_types = array['video/mp4', 'application/octet-stream']
where id = 'clip-exports';

-- Create is idempotent: the browser sends a fresh request_id per click, and a
-- repeat of the same one returns the project it already made (and charges nothing).
alter table public.clip_projects add column request_id uuid;
create unique index clip_projects_request_id_idx on public.clip_projects (user_id, request_id)
  where request_id is not null;

-- Hands the next job of `p_kinds` to `p_worker`: a queued one that's due, or a
-- running one whose worker stopped renewing its lease. SKIP LOCKED lets any
-- number of workers call this at once without two getting the same job.
create or replace function public.claim_clip_job(p_worker text, p_kinds text[], p_lease_seconds integer default 60)
returns setof public.clip_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.clip_jobs
  where kind = any (p_kinds)
    and (
      (status = 'queued' and run_after <= now())
      or (status = 'running' and locked_until < now() and attempts < max_attempts)
    )
  order by priority desc, created_at
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  return query
  update public.clip_jobs
  set status = 'running',
      attempts = attempts + 1,
      locked_by = p_worker,
      locked_until = now() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(started_at, now()),
      stage = coalesce(stage, 'waiting'),
      error_code = null,
      error_message = null
  where id = v_id
  returning *;
end;
$$;

-- Running jobs whose lease ran out with no attempts left: failed, so they
-- stop showing as in progress. The worker and the clips-poll cron call this.
create or replace function public.expire_clip_jobs()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.clip_jobs
    set status = 'failed',
        error_code = 'lease_expired',
        error_message = 'The render worker stopped responding.',
        finished_at = now()
    where status = 'running'
      and locked_until < now()
      and attempts >= max_attempts
    returning 1
  )
  select count(*)::integer from expired;
$$;

-- Service role only (see 20261105120000: revoke from public too).
revoke execute on function public.claim_clip_job(text, text[], integer) from public, anon, authenticated;
revoke execute on function public.expire_clip_jobs() from public, anon, authenticated;
grant execute on function public.claim_clip_job(text, text[], integer) to service_role;
grant execute on function public.expire_clip_jobs() to service_role;
