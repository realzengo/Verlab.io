-- TikTok's hashtag-search/trending-feed endpoints always return
-- author.follower_count = 0 (a platform limitation on those list endpoints).
-- The real number only comes from a dedicated per-handle profile lookup that
-- costs 1 SociaVault credit per call -- this table caches that result per
-- author so a niche refresh only pays for it once per author every few days,
-- not once per video or once per refresh.
create table public.tiktok_author_follower_cache (
  handle text primary key,
  follower_count bigint not null default 0,
  refreshed_at timestamptz not null default now()
);

alter table public.tiktok_author_follower_cache enable row level security;
