import { unstable_cache } from "next/cache";
import type { TranscriptAnalysis, TrendingVideo } from "@/lib/types";
import { NICHE_ORDER, nicheForHashtag } from "@/lib/niches-catalog";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TrendingVideoRow {
  id: string;
  title: string;
  views: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  follower_count: number;
  cover_url: string;
  video_url: string;
  author: string;
  avatar_url: string;
  hashtag: string;
  niche_category: string | null;
  posted_at: string | null;
  platform: "tiktok" | "youtube";
  // JSONB, already parsed to an object by postgrest-js -- null until the
  // enrichment worker (niche-video-enrichment.ts) has attempted this row.
  transcript_analysis: TranscriptAnalysis | null;
}

export const TRENDING_VIDEO_COLUMNS =
  "id, title, views, view_count, like_count, comment_count, share_count, follower_count, cover_url, video_url, author, avatar_url, hashtag, niche_category, posted_at, platform, transcript_analysis";

// niche_category is backfilled going forward, but rows ingested before that
// column existed fall back to the hashtag-derived niche so old cache entries
// still display correctly.
export function mapTrendingVideoRow(row: TrendingVideoRow): TrendingVideo {
  return {
    id: row.id,
    title: row.title,
    views: row.views,
    viewCount: row.view_count,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    shareCount: row.share_count,
    followerCount: row.follower_count,
    coverUrl: row.cover_url,
    videoUrl: row.video_url,
    author: row.author,
    avatarUrl: row.avatar_url,
    hashtag: row.hashtag,
    niche: row.niche_category ?? nicheForHashtag(row.hashtag),
    postedAt: row.posted_at,
    platform: row.platform,
    transcriptAnalysis: row.transcript_analysis,
  };
}

// trending_videos is only ever written by refreshNicheVideoCache's upsert
// (niche-video-refresh.ts) -- on a 30-min cron plus occasional on-demand
// backfills -- so both reads below are cheap to hold onto for a few minutes
// without the Niche Finder page (every visitor, every load) ever seeing data
// staler than the table itself already tolerates. refreshNicheVideoCache
// calls revalidateTag(TRENDING_VIDEOS_CACHE_TAG) after a successful write so
// a fresh scrape shows up immediately instead of waiting out the TTL.
export const TRENDING_VIDEOS_CACHE_TAG = "trending-videos";

/**
 * Views floor applied to a video feed ONLY when the viewer has set no views
 * filter of their own, so the default Niche Finder feed leads with videos
 * that actually went viral rather than whatever a scrape happened to return
 * in view order. It is never intersected with a user-set views range -- an
 * explicit filter (even a lower one) replaces this outright, so an applied
 * filter always means "everything on the market matching this". Lives here
 * rather than in niche-video-query.ts so the server-rendered first page and
 * the client's own fetches can't disagree about what the default feed is.
 * Sparse niches fall back to the relax-the-view-floor path in
 * getNicheVideosPage, so this can't blank out a niche with no 50K+ videos
 * cached yet.
 */
export const DEFAULT_VIRAL_VIEW_FLOOR = 50_000;

/**
 * Days of history the default feed covers (the client's DEFAULT_VIDEO_TIME_WINDOW
 * is "90d"). Hashtag scrapes surface plenty of videos that went viral a few
 * weeks back, so a 30-day window threw most of the pool away -- only ~300
 * viral videos and 6 of 31 niches made it into the default view.
 */
export const DEFAULT_FEED_WINDOW_DAYS = 90;
const NICHE_FEED_CACHE_TTL_SECONDS = 300;

// unstable_cache only coalesces concurrent callers when a (possibly stale)
// cache entry already exists to serve while it revalidates in the
// background -- verified against a real cold cache, N simultaneous requests
// for a key with NO existing entry each ran the query independently (N
// separate Supabase round trips, a thundering herd every time the TTL
// lapses and several visitors land at once). This single-flight map plugs
// that specific gap: concurrent calls for the same key while the first
// caller's query is still in-flight share its one promise instead of each
// starting their own. Per-instance only (not a cross-instance lock), but
// that's the right scope for a read repopulation -- collapsing N simultaneous
// requests on the same warm instance down to 1 query is what actually
// matters here, and each instance still ends up caching the same result.
const inFlight = new Map<string, Promise<unknown>>();

function dedupeInFlight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = run().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

const getCachedInitialNicheFeedInner = unstable_cache(
  async (limit: number): Promise<{ rows: TrendingVideoRow[]; hasMore: boolean }> => {
    const admin = createAdminClient();
    const windowStart = new Date(Date.now() - DEFAULT_FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("trending_videos")
      .select(TRENDING_VIDEO_COLUMNS)
      .gte("posted_at", windowStart)
      // Same default viral floor the client's own fetches apply (see
      // DEFAULT_VIRAL_VIEW_FLOOR) -- without it, first paint showed a feed
      // this page's very first client-side refetch would then replace.
      .gte("view_count", DEFAULT_VIRAL_VIEW_FLOOR)
      .order("view_count", { ascending: false })
      .range(0, limit);

    if (error) {
      console.error("Failed to load initial trending videos page:", error);
      return { rows: [], hasMore: false };
    }

    const rows = (data as TrendingVideoRow[]) ?? [];
    return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
  },
  ["niches-initial-feed"],
  { tags: [TRENDING_VIDEOS_CACHE_TAG], revalidate: NICHE_FEED_CACHE_TTL_SECONDS }
);

/**
 * First page of the "all niches" feed (default window, ranked by views) -- the
 * query that blocks first paint on every /niches visit. Unauthenticated and
 * identical for every visitor (no per-user filtering), so it's cached
 * globally rather than per caller. Uses the service-role client since the
 * cached result is shared across requests/users, unlike the page's own
 * cookie-scoped client.
 */
export function getCachedInitialNicheFeed(limit: number): Promise<{ rows: TrendingVideoRow[]; hasMore: boolean }> {
  return dedupeInFlight(`niches-initial-feed:${limit}`, () => getCachedInitialNicheFeedInner(limit));
}

const getCachedNicheCountsInner = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const admin = createAdminClient();
    const windowStart = new Date(Date.now() - DEFAULT_FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    // One exact head-count per niche, over the same window and viral floor
    // the default feed applies, so a niche's badge matches what selecting it
    // shows. Replaces a niche_video_counts_30d() RPC that was never migrated
    // into production and a 5000-row JS sample that PostgREST silently capped
    // at 1000 rows.
    const results = await Promise.all(
      NICHE_ORDER.map(async (niche) => {
        const { count, error } = await admin
          .from("trending_videos")
          .select("id", { count: "exact", head: true })
          .eq("niche_category", niche)
          .gte("posted_at", windowStart)
          .gte("view_count", DEFAULT_VIRAL_VIEW_FLOOR);
        if (error) console.warn(`[trending-videos] count failed for ${niche}:`, error.message);
        return [niche, count ?? 0] as const;
      })
    );
    return Object.fromEntries(results);
  },
  ["niches-category-counts-v2"],
  { tags: [TRENDING_VIDEOS_CACHE_TAG], revalidate: NICHE_FEED_CACHE_TTL_SECONDS }
);

/**
 * Per-niche video counts for the sidebar, over the feed's own default window
 * and viral floor so the dropdown badges and the grid agree. Takes
 * zero request-specific parameters and is identical for every visitor, so
 * it's cached globally.
 */
export function getCachedNicheCounts(): Promise<Record<string, number>> {
  return dedupeInFlight("niches-category-counts", getCachedNicheCountsInner);
}
