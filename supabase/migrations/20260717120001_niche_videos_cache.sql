alter table public.trending_videos
  add column niche_category text;

create index trending_videos_niche_category_view_count_idx
  on public.trending_videos (niche_category, view_count desc);

-- Coordinates on-demand per-niche Apify refreshes triggered by page views
-- (see /api/niches/[niche]/videos) so concurrent requests for the same
-- stale niche don't each kick off their own scrape.
create table public.niche_video_refresh_locks (
  niche_category text primary key,
  status text not null default 'idle' check (status in ('idle', 'refreshing')),
  started_at timestamptz,
  finished_at timestamptz
);

alter table public.niche_video_refresh_locks enable row level security;
