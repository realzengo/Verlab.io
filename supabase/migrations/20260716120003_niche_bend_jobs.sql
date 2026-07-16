-- Replaces the in-memory Map in src/lib/server/niche-bend-job-store.ts, which
-- does not survive across serverless invocations / multiple instances.
create table public.niche_bend_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null default '',
  platform text not null check (platform in ('youtube','tiktok')),
  video_type text not null check (video_type in ('shorts','long-form')),
  manual_videos jsonb,
  status text not null default 'opening_channel'
    check (status in ('opening_channel','reading_videos','identifying_format','generating_bends','ready','generating_sop','sop_ready','failed')),
  error_message text,
  analysis jsonb,
  candidates jsonb,
  conversation jsonb,
  chosen_bend jsonb,
  sop jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.niche_bend_jobs enable row level security;

create policy "Users can view own niche bend jobs"
  on public.niche_bend_jobs for select
  using (auth.uid() = user_id);

create policy "Users can create own niche bend jobs"
  on public.niche_bend_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own niche bend jobs"
  on public.niche_bend_jobs for update
  using (auth.uid() = user_id);

create trigger niche_bend_jobs_set_updated_at
  before update on public.niche_bend_jobs
  for each row
  execute function public.set_updated_at();

create index niche_bend_jobs_user_id_idx on public.niche_bend_jobs (user_id, created_at desc);

-- Cross-user dedup cache so "Regenerate bends" skips re-running (paid) web
-- search for a channel that's already been researched. Internal infra, not
-- user data — service-role only, no RLS policies granted.
create table public.niche_bend_research_cache (
  cache_key text primary key,
  analysis jsonb not null,
  conversation jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.niche_bend_research_cache enable row level security;
