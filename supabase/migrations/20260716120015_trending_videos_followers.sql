alter table public.trending_videos
  add column follower_count bigint not null default 0;
