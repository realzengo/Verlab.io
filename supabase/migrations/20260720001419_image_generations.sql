create table public.image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  model text not null,
  aspect_ratio text not null,
  outputs integer not null,
  images jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.image_generations enable row level security;

create policy "Users can view own image generations"
  on public.image_generations for select
  using (auth.uid() = user_id);

create policy "Users can create own image generations"
  on public.image_generations for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own image generations"
  on public.image_generations for delete
  using (auth.uid() = user_id);

create index image_generations_user_id_idx on public.image_generations (user_id, created_at desc);
