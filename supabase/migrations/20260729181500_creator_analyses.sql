create table public.creator_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  platform text not null check (platform in ('tiktok','youtube')),
  status text not null default 'processing' check (status in ('processing','complete','failed')),
  channel_name text,
  videos jsonb,
  summary text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_analyses enable row level security;

create policy "Users can view own creator analyses"
  on public.creator_analyses for select
  using (auth.uid() = user_id);

create policy "Users can create own creator analyses"
  on public.creator_analyses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own creator analyses"
  on public.creator_analyses for update
  using (auth.uid() = user_id);

create policy "Users can delete own creator analyses"
  on public.creator_analyses for delete
  using (auth.uid() = user_id);

create trigger creator_analyses_set_updated_at
  before update on public.creator_analyses
  for each row
  execute function public.set_updated_at();

create index creator_analyses_user_id_idx on public.creator_analyses (user_id, created_at desc);
