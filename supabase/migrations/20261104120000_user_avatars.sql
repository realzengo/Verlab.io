-- A user's own avatars for the avatar picker (Video Generator > Clone >
-- "Choose avatar"), alongside the bundled presets in public/clone-presets.
-- Each row is one image, generated in-app or uploaded, which the server
-- re-encoded and stored in the private `user-avatars` bucket below.
-- gender/age_range are optional tags the picker's filter pills match on.
create table public.user_avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  gender text check (gender in ('female', 'male')),
  age_range text check (age_range in ('20s', '30s', '40s', '60s')),
  source text not null check (source in ('generated', 'uploaded')),
  image_path text not null,
  width integer not null,
  height integer not null,
  created_at timestamptz not null default now()
);

alter table public.user_avatars enable row level security;

create policy "Users can view own avatars"
  on public.user_avatars for select
  using (auth.uid() = user_id);

create policy "Users can create own avatars"
  on public.user_avatars for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own avatars"
  on public.user_avatars for delete
  using (auth.uid() = user_id);

create index user_avatars_user_id_idx on public.user_avatars (user_id, created_at desc);

-- Private (unlike the older public `avatars` bucket, which is for profile
-- pictures and has no writer): these are often photos of the user, so
-- they're served only through GET /api/avatars/[id]/image after an
-- ownership check. Objects live at <user_id>/<avatar_id>.jpg.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-avatars', 'user-avatars', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

-- App code only touches this bucket through the service-role client, so
-- these are defense-in-depth, matching every other bucket's policies.
create policy "Users can view their own avatar library images"
  on storage.objects for select
  using (
    bucket_id = 'user-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can upload their own avatar library images"
  on storage.objects for insert
  with check (
    bucket_id = 'user-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own avatar library images"
  on storage.objects for delete
  using (
    bucket_id = 'user-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
