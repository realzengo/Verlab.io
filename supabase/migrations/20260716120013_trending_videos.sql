create table public.trending_videos (
  id text primary key,
  title text not null,
  views text not null,
  view_count bigint not null default 0,
  cover_url text not null default '',
  video_url text not null default '',
  author text not null default '',
  avatar_url text not null default '',
  hashtag text not null default '',
  region text not null default 'US',
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.trending_videos enable row level security;

create policy "Authenticated users can read trending videos"
  on public.trending_videos for select
  to authenticated
  using (true);

create index trending_videos_view_count_idx on public.trending_videos (view_count desc);
