import type { SupabaseClient } from "@supabase/supabase-js";

interface EngagementRow {
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

function engagementRate(row: EngagementRow): number {
  return (row.like_count + row.comment_count + row.share_count) / Math.max(row.view_count, 1);
}

export interface VideoOutlierInsights {
  video: {
    id: string;
    title: string;
    viewCount: number;
    nicheCategory: string;
    postedAt: string | null;
  };
  outlierIndex: number;
  engagementRate: number;
  niche: {
    totalVideos: number;
    avgViews: number;
    rank: number;
    percentileTop: number;
    viewsVsAvg: number;
    engagementVsAvg: number;
  };
  creator: {
    basis: "peer_videos" | "follower_count";
    sampleSize: number;
    viewsVsReach: number;
  };
}

/**
 * Shared by the insights route (renders the Outlier Score panel) and the
 * video-ideas route (feeds the LLM's source-video context) -- both need the
 * same niche-relative math, computed once per call rather than duplicated.
 */
export async function computeVideoOutlierInsights(admin: SupabaseClient, videoId: string): Promise<VideoOutlierInsights | null> {
  const { data: video, error: videoError } = await admin
    .from("trending_videos")
    .select("id, title, view_count, like_count, comment_count, share_count, follower_count, niche_category, platform, author, posted_at")
    .eq("id", videoId)
    .single();

  if (videoError || !video) return null;

  // The peer pool this video is scored against: every other video currently
  // cached for the same niche+platform. Bounded by the same per-niche cache
  // size the refresh pipeline already maintains (a few hundred rows at
  // most), so pulling it whole and reducing in JS is cheap -- no need for a
  // Postgres-side aggregate.
  const { data: nichePeers } = await admin
    .from("trending_videos")
    .select("view_count, like_count, comment_count, share_count")
    .eq("niche_category", video.niche_category)
    .eq("platform", video.platform);

  const pool = nichePeers && nichePeers.length > 0 ? nichePeers : [video];
  const total = pool.length;
  const thisEngagement = engagementRate(video);

  const nicheAvgViews = pool.reduce((sum, r) => sum + r.view_count, 0) / total;
  const nicheAvgEngagement = pool.reduce((sum, r) => sum + engagementRate(r), 0) / total;
  // 1-indexed rank by views -- video's own row never counts against itself
  // since view_count > view_count is false.
  const rank = 1 + pool.filter((r) => r.view_count > video.view_count).length;
  const atOrBelowEngagement = pool.filter((r) => engagementRate(r) <= thisEngagement).length;
  const outlierIndex = Math.round((atOrBelowEngagement / total) * 100);

  // Best-effort creator grouping -- there's no stable per-creator id in
  // trending_videos, so this matches on the display name/platform pair.
  // Good enough for a supplementary insight tile; not exact for creators
  // who share a display name.
  const { data: creatorPeers } = await admin
    .from("trending_videos")
    .select("view_count")
    .eq("author", video.author)
    .eq("platform", video.platform)
    .neq("id", videoId)
    .limit(50);

  const hasCreatorPeers = Boolean(creatorPeers && creatorPeers.length > 0);
  const creatorAvgViews = hasCreatorPeers
    ? creatorPeers!.reduce((sum, r) => sum + r.view_count, 0) / creatorPeers!.length
    : null;
  // No other cached videos from this creator to compare against -- fall back
  // to views-per-follower as the "expected reach" baseline instead.
  const creatorReachBasis = creatorAvgViews ?? Math.max(video.follower_count, 1);

  return {
    video: {
      id: video.id,
      title: video.title,
      viewCount: video.view_count,
      nicheCategory: video.niche_category,
      postedAt: video.posted_at,
    },
    outlierIndex,
    engagementRate: thisEngagement,
    niche: {
      totalVideos: total,
      avgViews: Math.round(nicheAvgViews),
      rank,
      percentileTop: Math.max(1, Math.round((rank / total) * 100)),
      viewsVsAvg: video.view_count / Math.max(nicheAvgViews, 1),
      engagementVsAvg: thisEngagement / Math.max(nicheAvgEngagement, 0.0001),
    },
    creator: {
      basis: hasCreatorPeers ? "peer_videos" : "follower_count",
      sampleSize: creatorPeers?.length ?? 0,
      viewsVsReach: video.view_count / Math.max(creatorReachBasis, 1),
    },
  };
}
