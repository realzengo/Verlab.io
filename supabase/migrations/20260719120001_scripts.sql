create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scripts enable row level security;

create policy "Users can view own scripts"
  on public.scripts for select
  using (auth.uid() = user_id);

create policy "Users can create own scripts"
  on public.scripts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scripts"
  on public.scripts for update
  using (auth.uid() = user_id);

create policy "Users can delete own scripts"
  on public.scripts for delete
  using (auth.uid() = user_id);

create trigger scripts_set_updated_at
  before update on public.scripts
  for each row
  execute function public.set_updated_at();

create index scripts_user_id_idx on public.scripts (user_id, created_at desc);

-- One persisted SOP and one persisted Transcript reference file per user,
-- kept around across sessions so the Script Writer's Prompter doesn't need
-- the file re-uploaded on every generation.
create table public.script_reference_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('sop', 'transcript')),
  file_name text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

alter table public.script_reference_files enable row level security;

create policy "Users can view own script reference files"
  on public.script_reference_files for select
  using (auth.uid() = user_id);

create policy "Users can create own script reference files"
  on public.script_reference_files for insert
  with check (auth.uid() = user_id);

create policy "Users can update own script reference files"
  on public.script_reference_files for update
  using (auth.uid() = user_id);

create policy "Users can delete own script reference files"
  on public.script_reference_files for delete
  using (auth.uid() = user_id);

create trigger script_reference_files_set_updated_at
  before update on public.script_reference_files
  for each row
  execute function public.set_updated_at();

create index script_reference_files_user_id_idx on public.script_reference_files (user_id, created_at desc);
