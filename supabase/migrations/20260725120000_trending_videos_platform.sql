-- YouTube support for Niche Finder: trending_videos needs a platform column
-- to distinguish TikTok (SociaVault) rows from YouTube (Data API v3) rows.
-- Existing rows are all TikTok, hence the default.
alter table public.trending_videos
  add column platform text not null default 'tiktok' check (platform in ('tiktok', 'youtube'));

create index trending_videos_platform_niche_view_count_idx
  on public.trending_videos (platform, niche_category, view_count desc);

-- Refresh locks are now scoped per (niche, platform) instead of just niche —
-- TikTok and YouTube scrape independently and can be mid-refresh for the same
-- niche at the same time without stepping on each other's lock.
alter table public.niche_video_refresh_locks
  drop constraint niche_video_refresh_locks_pkey;

alter table public.niche_video_refresh_locks
  add column platform text not null default 'tiktok' check (platform in ('tiktok', 'youtube'));

alter table public.niche_video_refresh_locks
  add primary key (niche_category, platform);
