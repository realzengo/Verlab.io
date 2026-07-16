create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  platform text not null check (platform in ('tiktok','reels','shorts')),
  status text not null default 'queued' check (status in ('queued','processing','complete','failed')),
  title text,
  cover_url text,
  duration_seconds int,
  lines jsonb,
  provider text not null default 'supadata',
  provider_job_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transcripts enable row level security;

create policy "Users can view own transcripts"
  on public.transcripts for select
  using (auth.uid() = user_id);

create policy "Users can create own transcripts"
  on public.transcripts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transcripts"
  on public.transcripts for update
  using (auth.uid() = user_id);

create policy "Users can delete own transcripts"
  on public.transcripts for delete
  using (auth.uid() = user_id);

create trigger transcripts_set_updated_at
  before update on public.transcripts
  for each row
  execute function public.set_updated_at();

create index transcripts_user_id_idx on public.transcripts (user_id, created_at desc);
