create table public.niche_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('youtube','tiktok','both')),
  answers jsonb not null,
  status text not null default 'processing' check (status in ('processing','complete','failed')),
  niches jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.niche_reports enable row level security;

create policy "Users can view own niche reports"
  on public.niche_reports for select
  using (auth.uid() = user_id);

create policy "Users can create own niche reports"
  on public.niche_reports for insert
  with check (auth.uid() = user_id);

create policy "Users can update own niche reports"
  on public.niche_reports for update
  using (auth.uid() = user_id);

create policy "Users can delete own niche reports"
  on public.niche_reports for delete
  using (auth.uid() = user_id);

create trigger niche_reports_set_updated_at
  before update on public.niche_reports
  for each row
  execute function public.set_updated_at();

create index niche_reports_user_id_idx on public.niche_reports (user_id, created_at desc);
