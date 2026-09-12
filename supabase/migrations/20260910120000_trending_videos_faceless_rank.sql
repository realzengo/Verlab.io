-- Promotes "is this video faceless?" from a signal scattered across two
-- places into a first-class, sortable column on trending_videos.
--
-- Before this, the verdict lived in exactly two spots, neither sortable:
--   1. transcript_analysis->>'is_faceless' -- jsonb, written by the per-video
--      enrichment worker (niche-video-enrichment.ts). Real, but it had only
--      ever covered 27 of ~6000 rows, because each verdict costs a transcript
--      fetch plus an LLM call.
--   2. niche_channels.is_faceless -- channel-level, joined to videos by an
--      inexact lowercased channel-name match in JS (there's no FK between the
--      tables), and only inside a capped 600-row batch.
--
-- Neither could drive ORDER BY, so the feed could only ever sort by raw view
-- count -- which is why on-camera content dominated a product whose whole
-- point is faceless content. A materialized column fixes that: the feed can
-- rank faceless-first in SQL, and the "faceless only" filter stops being a
-- batch-capped JS scan.
--
-- Why a smallint rank rather than a boolean or an enum: PostgREST can't
-- express CASE in .order(), so the sort key has to already exist as a column.
-- The encoding deliberately puts unknown BETWEEN the two known states --
--   0 = faceless, 1 = unknown, 2 = not faceless
-- so unclassified videos outrank content we know shows a face, and nothing is
-- ever hidden from the feed. A hard gate on a low-coverage classification is
-- exactly what broke the Niche Finder page once before (see
-- 20260809120000_niche_channels_drop_faceless_gate.sql); ranking degrades
-- gracefully where filtering did not.
alter table public.trending_videos
  add column faceless_rank smallint not null default 1,
  add column faceless_confidence numeric check (faceless_confidence between 0 and 100),
  add column faceless_source text check (faceless_source in ('metadata', 'transcript', 'channel')),
  add column faceless_classified_at timestamptz;

comment on column public.trending_videos.faceless_rank is
  'Sort key for faceless-first ranking: 0 = faceless, 1 = unknown/unclassified, '
  '2 = not faceless. Unknown sits in the middle so unclassified rows outrank '
  'known on-camera rows. Written by the batch classifier '
  '(faceless-classification-worker.ts); see faceless_source for provenance.';

comment on column public.trending_videos.faceless_source is
  'Which pass produced faceless_rank. "metadata" = cheap batched '
  'title/channel/hashtag classification; "transcript" = the per-video '
  'transcript pass (higher confidence, never overwritten by metadata); '
  '"channel" = inherited from a niche_channels verdict via channel-name match.';

-- Feed ordering: platform-scoped (the "All" tab queries each platform
-- separately and interleaves them) and niche-scoped, both ranking
-- faceless-first then by views.
create index trending_videos_platform_faceless_views_idx
  on public.trending_videos (platform, faceless_rank, view_count desc);

create index trending_videos_niche_faceless_views_idx
  on public.trending_videos (niche_category, platform, faceless_rank, view_count desc);

-- The classifier's "what still needs a verdict?" queue. Partial so it stays
-- small as coverage fills in, mirroring
-- trending_videos_pending_transcript_analysis_idx.
create index trending_videos_pending_faceless_idx
  on public.trending_videos (refreshed_at)
  where faceless_classified_at is null;

-- Backfill from the signal that already exists, so ranking works the moment
-- this lands instead of waiting on a full classification pass.

-- 1. The per-video transcript verdicts (highest confidence available).
update public.trending_videos
set
  faceless_rank = case when (transcript_analysis->>'is_faceless')::boolean then 0 else 2 end,
  faceless_confidence = nullif(transcript_analysis->>'confidence', '')::numeric,
  faceless_source = 'transcript',
  faceless_classified_at = coalesce(
    nullif(transcript_analysis->>'analyzed_at', '')::timestamptz,
    now()
  )
where transcript_analysis->>'status' = 'analyzed';

-- 2. Channel-level verdicts for anything still unclassified. Same inexact
-- (platform, lowercased channel name) match the query layer used to do in JS
-- -- there's no real foreign key between these tables. Only positive
-- (is_faceless = true) verdicts are inherited: a channel marked not-faceless
-- is a weaker claim about any individual video than a positive one is, and
-- the metadata pass will cover those rows shortly anyway.
update public.trending_videos v
set
  faceless_rank = 0,
  faceless_confidence = c.faceless_confidence,
  faceless_source = 'channel',
  faceless_classified_at = now()
from public.niche_channels c
where v.faceless_classified_at is null
  and c.is_faceless = true
  and c.platform = v.platform
  and lower(trim(c.channel_title)) = lower(trim(v.author));

-- Exact per-niche counts for the niches dropdown, scoped to the same 30-day
-- window the feed itself uses. The previous implementation tallied an
-- arbitrary, unordered .limit(5000) sample in JS with no date filter, so the
-- badge could disagree with what the grid actually rendered (and silently
-- truncate once the table outgrew the sample).
create or replace function public.niche_video_counts_30d()
returns table (niche_category text, video_count bigint)
language sql
stable
as $$
  select v.niche_category, count(*)::bigint as video_count
  from public.trending_videos v
  where v.posted_at >= now() - interval '30 days'
    and v.niche_category is not null
  group by v.niche_category;
$$;

comment on function public.niche_video_counts_30d() is
  'Per-niche video counts over the trailing 30 days -- matches the feed''s '
  'default posted_at window so dropdown counts and grid contents agree. '
  'Not SECURITY DEFINER: trending_videos is service-role-only (RLS enabled '
  'with no policies), so this returns rows only for the admin client that '
  'calls it server-side.';
