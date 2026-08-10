-- Denormalized snapshot rather than a trending_videos FK: the cache table is
-- routinely purged/refreshed (24h TTL, on-demand cache-aside scrapes), so a
-- saved video must keep rendering correctly even after its source row is
-- gone from trending_videos.
create table public.saved_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  platform text not null,
  title text not null,
  views text not null default '',
  view_count bigint not null default 0,
  like_count bigint not null default 0,
  comment_count bigint not null default 0,
  share_count bigint not null default 0,
  follower_count bigint not null default 0,
  cover_url text not null default '',
  video_url text not null default '',
  author text not null default '',
  avatar_url text not null default '',
  hashtag text not null default '',
  niche text not null default '',
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

alter table public.saved_videos enable row level security;

create policy "Users can view own saved videos"
  on public.saved_videos for select
  using (auth.uid() = user_id);

create policy "Users can save videos"
  on public.saved_videos for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave own videos"
  on public.saved_videos for delete
  using (auth.uid() = user_id);

create index saved_videos_user_id_idx on public.saved_videos (user_id, created_at desc);
