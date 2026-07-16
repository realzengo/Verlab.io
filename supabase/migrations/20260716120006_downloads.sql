create table public.downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  platform text not null check (platform in ('tiktok','youtube','instagram')),
  format text not null check (format in ('mp4','mp3')),
  status text not null default 'queued' check (status in ('queued','processing','complete','failed')),
  title text,
  file_path text,
  provider text not null default 'supadata',
  provider_job_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.downloads enable row level security;

create policy "Users can view own downloads"
  on public.downloads for select
  using (auth.uid() = user_id);

create policy "Users can create own downloads"
  on public.downloads for insert
  with check (auth.uid() = user_id);

create policy "Users can update own downloads"
  on public.downloads for update
  using (auth.uid() = user_id);

create policy "Users can delete own downloads"
  on public.downloads for delete
  using (auth.uid() = user_id);

create trigger downloads_set_updated_at
  before update on public.downloads
  for each row
  execute function public.set_updated_at();

create index downloads_user_id_idx on public.downloads (user_id, created_at desc);
