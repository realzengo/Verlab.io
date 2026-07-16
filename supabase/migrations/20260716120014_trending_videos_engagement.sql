alter table public.trending_videos
  add column like_count bigint not null default 0,
  add column comment_count bigint not null default 0,
  add column share_count bigint not null default 0,
  add column posted_at timestamptz;
