-- Adds a slot for Gemini-analyzed transcript data on trending_videos, so the
-- Phase 3 enrichment worker can attach structured per-video analysis (niche,
-- faceless verdict, hook strength, summary, ...) without a separate table or
-- join. NULL means "not yet analyzed" -- the partial index below is exactly
-- the worker's "find the next batch to enrich" queue query.
--
-- Metrics are NOT re-typed here because they're already bigint:
-- view_count/like_count/comment_count/share_count/follower_count on
-- trending_videos (20260716120013_trending_videos.sql,
-- 20260716120014_trending_videos_engagement.sql,
-- 20260716120015_trending_videos_followers.sql) and
-- subscriber_count/total_views on niche_channels
-- (20260808120000_niche_channels.sql) were already bigint before this
-- migration -- there is no 32-bit cap to raise. Metric B-Tree indices
-- (view_count desc; (niche_category, view_count desc);
-- (platform, niche_category, view_count desc)) already exist for the same
-- reason.
alter table public.trending_videos
  add column transcript_analysis jsonb;

-- Partial index: only rows still awaiting enrichment are ever scanned by the
-- worker's queue query, so this index stays small and fast even once most of
-- the table has been analyzed -- unlike a full index on the column, which
-- would grow with the whole table for a predicate nobody queries on once
-- enrichment catches up.
create index trending_videos_pending_transcript_analysis_idx
  on public.trending_videos (refreshed_at)
  where transcript_analysis is null;

-- GIN index for querying inside the analyzed payload once populated, e.g.
-- transcript_analysis->>'niche' or transcript_analysis->>'is_faceless' from
-- a future API filter.
create index trending_videos_transcript_analysis_gin_idx
  on public.trending_videos using gin (transcript_analysis);
