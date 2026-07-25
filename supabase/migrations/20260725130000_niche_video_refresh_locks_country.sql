-- Country-scoped YouTube discovery (Niche Finder country filter): refresh
-- locks need a country dimension so switching country triggers a fresh
-- scrape for that region instead of reusing (or blocking on) a different
-- country's in-flight refresh. TikTok is never region-scoped (SociaVault's
-- hashtag search has no country param), so TikTok rows always use 'global'.
alter table public.niche_video_refresh_locks
  drop constraint niche_video_refresh_locks_pkey;

alter table public.niche_video_refresh_locks
  add column country text not null default 'global';

alter table public.niche_video_refresh_locks
  add primary key (niche_category, platform, country);
