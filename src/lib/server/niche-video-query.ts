import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapTrendingVideoRow, TRENDING_VIDEO_COLUMNS, type TrendingVideoRow } from "@/lib/server/trending-videos";
import {
  GLOBAL_REGION,
  isNicheCacheStale,
  refreshNicheVideoCache,
  type VideoPlatform,
} from "@/lib/server/niche-video-refresh";
import {
  searchTikTokHashtag,
  searchTikTokKeyword,
  searchTikTokUserVideos,
  type TrendingTikTokVideo,
} from "@/lib/server/sociavault-client";
import { fetchNicheYoutubeVideos, type TrendingYoutubeVideo } from "@/lib/server/youtube-client";
import { backfillTikTokVideoFollowerCounts } from "@/lib/server/tiktok-follower-cache";
import { NICHE_ORDER, nicheForHashtag, type NicheName } from "@/lib/niches-catalog";
import type { TrendingVideo } from "@/lib/types";

// How many niches to backfill in one shot when the "All niches" view has
// zero cached rows for the requested platform/country.
const ALL_NICHES_WARM_COUNT = 3;
const ALL_NICHES_WARM_TARGET = 30;

// Outlier score and views-per-hour aren't stored columns -- they're derived
// in JS from a capped batch fetch (see runQuery below) rather than filtered
// in SQL. This bounds how many matching rows get pulled per request.
const DERIVED_FILTER_BATCH_CAP = 600;

const TIME_WINDOW_DAYS: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export interface NicheVideoQueryParams {
  page: number;
  limit: number;
  style: string;
  platform: VideoPlatform | "all";
  timeWindow: string;
  /** Comma-separated 2-letter YouTube region codes (e.g. "US,CA,DE"); empty
   * means worldwide. TikTok has no region concept, so this only ever narrows
   * the YouTube slice of results (see the `.or()` filter below). */
  country: string;
  viewsMin: string | null;
  viewsMax: string | null;
  followersMin: string | null;
  followersMax: string | null;
  postedAfter: string | null;
  postedBefore: string | null;
  /** Outlier index = this video's views ÷ the average views among the
   * currently matching cached videos, as a multiplier (1x-100x+). Derived in
   * JS, not a stored column -- see DERIVED_FILTER_BATCH_CAP. */
  outlierMin?: string | null;
  outlierMax?: string | null;
  /** Views ÷ hours since posted. Same derived-in-JS treatment as outlier. */
  viewsPerHourMin?: string | null;
  viewsPerHourMax?: string | null;
  /** Free-text match against title/author/hashtag -- the search box in the
   * niche finder's top bar. Empty/omitted means no text filter. */
  q: string | null;
  /** "views" (default) ranks by real view_count; "newest" ranks by real
   * posted_at -- both are genuine columns already on trending_videos, no
   * separate "trending score" concept exists to sort by. */
  sort: "views" | "newest";
}

export interface NicheVideoPage {
  videos: TrendingVideo[];
  page: number;
  limit: number;
  hasMore: boolean;
}

type LiveSearchMode = "hashtag" | "user" | "keyword";

// "#tag" / "@handle" prefixes select an exact live lookup (a specific
// hashtag's videos, or a specific creator's own videos); anything else runs
// as a plain keyword search -- the same universal search TikTok's own app
// search bar runs, so it already surfaces videos matching a creator's name
// or an untagged hashtag word too.
function parseLiveSearchQuery(rawQuery: string): { mode: LiveSearchMode; term: string } {
  if (rawQuery.startsWith("#")) return { mode: "hashtag", term: rawQuery.slice(1).trim() };
  if (rawQuery.startsWith("@")) return { mode: "user", term: rawQuery.slice(1).trim() };
  return { mode: "keyword", term: rawQuery.trim() };
}

function mapSearchResult(v: TrendingTikTokVideo | TrendingYoutubeVideo, platform: VideoPlatform): TrendingVideo {
  return {
    id: v.id,
    title: v.title,
    views: v.views,
    viewCount: v.viewCount,
    likeCount: v.likeCount,
    commentCount: v.commentCount,
    shareCount: v.shareCount,
    followerCount: v.followerCount,
    coverUrl: v.coverUrl,
    videoUrl: v.videoUrl,
    author: v.author,
    avatarUrl: v.avatarUrl,
    hashtag: v.hashtag,
    niche: nicheForHashtag(v.hashtag),
    postedAt: v.postedAt,
    platform,
  };
}

function matchesStyle(hashtag: string, style: string): boolean {
  const h = hashtag.toLowerCase();
  if (style === "ai-generated") return h.includes("ai");
  if (style === "2d-animation") return h.includes("2d") || h.includes("animat");
  if (style === "narrated") return !h.includes("ai") && !h.includes("2d") && !h.includes("animat");
  return true;
}

// Real TikTok follower counts only ever come from a dedicated per-handle
// profile lookup (1 SociaVault credit each, cached for a week -- see
// tiktok-follower-cache.ts). Resolving that for every video a scrape or a
// live search happens to touch was the actual cost driver (a 30-minute cron
// alone was burning ~1 credit per never-before-seen author, 48x/day,
// independent of real traffic) -- this bounds the spend to exactly the page
// a user is looking at right now. Only rows still at the native 0 placeholder
// are looked up: YouTube rows already carry a real subscriber count from the
// scrape itself, and the "@handle" live-search mode already returns a real
// count straight from the profile-videos endpoint -- re-resolving either
// would just burn a credit to fetch back the number already in hand.
async function backfillPageFollowerCounts(admin: SupabaseClient, videos: TrendingVideo[]): Promise<void> {
  const tiktokVideos = videos.filter((v) => v.platform === "tiktok" && v.followerCount === 0);
  if (tiktokVideos.length === 0) return;
  await backfillTikTokVideoFollowerCounts(admin, tiktokVideos);
}

/**
 * Live equivalent of buildBaseQuery/applyDerivedFilters below, for when the
 * user typed something into the search box. The trending_videos cache only
 * ever holds our fixed FACELESS_HASHTAGS catalog, so filtering it for an
 * arbitrary user/hashtag/keyword would silently come back empty for
 * anything outside that list -- this hits SociaVault/YouTube's real search
 * endpoints directly instead, then filters/sorts/paginates the live results
 * in JS. Search intentionally ignores the niche filter -- typing into the
 * box is the user overriding "browse this niche" with "find this specific
 * thing", the same way it would on TikTok's or YouTube's own search.
 */
async function searchLiveVideos(rawQuery: string, params: NicheVideoQueryParams): Promise<NicheVideoPage> {
  const { page, limit, style, platform, timeWindow, country, sort } = params;
  const { viewsMin, viewsMax, followersMin, followersMax, postedAfter, postedBefore } = params;
  const outlierMin = params.outlierMin ?? null;
  const outlierMax = params.outlierMax ?? null;
  const viewsPerHourMin = params.viewsPerHourMin ?? null;
  const viewsPerHourMax = params.viewsPerHourMax ?? null;
  const offset = (page - 1) * limit;
  const countries = country ? country.split(",").filter(Boolean) : [];
  const { mode, term } = parseLiveSearchQuery(rawQuery);

  if (!term) return { videos: [], page, limit, hasMore: false };

  // How deep to fetch from the live provider before filtering/paginating in
  // JS -- has to cover at least this page's offset, with a buffer since
  // filters below only ever shrink the pool. Capped at the same ceiling as
  // the cached-DB derived-filter path (DERIVED_FILTER_BATCH_CAP) to bound
  // worst-case credit spend per search box submission.
  const targetCount = Math.min(DERIVED_FILTER_BATCH_CAP, Math.max(offset + limit + 40, 100));
  const wantsTikTok = platform !== "youtube";
  const wantsYoutube = platform !== "tiktok";
  const youtubeRegion = countries.length === 1 ? countries[0] : null;

  const [tiktokOutcome, youtubeOutcome] = await Promise.allSettled([
    wantsTikTok
      ? mode === "hashtag"
        ? searchTikTokHashtag(term, targetCount)
        : mode === "user"
          ? searchTikTokUserVideos(term, targetCount)
          : searchTikTokKeyword(term, targetCount)
      : Promise.resolve([]),
    wantsYoutube ? fetchNicheYoutubeVideos([term], targetCount, youtubeRegion) : Promise.resolve([]),
  ]);

  if (tiktokOutcome.status === "rejected") {
    console.warn(`[niche-video-query] live TikTok search ("${mode}: ${term}") failed:`, tiktokOutcome.reason);
  }
  if (youtubeOutcome.status === "rejected") {
    console.warn(`[niche-video-query] live YouTube search ("${term}") failed:`, youtubeOutcome.reason);
  }

  let results: TrendingVideo[] = [
    ...(tiktokOutcome.status === "fulfilled" ? tiktokOutcome.value.map((v) => mapSearchResult(v, "tiktok")) : []),
    ...(youtubeOutcome.status === "fulfilled" ? youtubeOutcome.value.map((v) => mapSearchResult(v, "youtube")) : []),
  ];

  if (style !== "all") results = results.filter((v) => matchesStyle(v.hashtag, style));
  if (viewsMin) results = results.filter((v) => v.viewCount >= Number(viewsMin));
  if (viewsMax) results = results.filter((v) => v.viewCount <= Number(viewsMax));
  if (followersMin) results = results.filter((v) => v.followerCount >= Number(followersMin));
  if (followersMax) results = results.filter((v) => v.followerCount <= Number(followersMax));

  if (postedAfter || postedBefore) {
    const afterMs = postedAfter ? new Date(postedAfter).getTime() : null;
    const beforeMs = postedBefore ? new Date(postedBefore).getTime() : null;
    results = results.filter((v) => {
      if (!v.postedAt) return false;
      const ms = new Date(v.postedAt).getTime();
      return (afterMs === null || ms >= afterMs) && (beforeMs === null || ms <= beforeMs);
    });
  } else if (TIME_WINDOW_DAYS[timeWindow]) {
    const cutoff = Date.now() - TIME_WINDOW_DAYS[timeWindow] * 24 * 60 * 60 * 1000;
    results = results.filter((v) => v.postedAt && new Date(v.postedAt).getTime() >= cutoff);
  }

  if (outlierMin || outlierMax || viewsPerHourMin || viewsPerHourMax) {
    const avgViews = results.length > 0 ? results.reduce((sum, v) => sum + v.viewCount, 0) / results.length : 1;
    const now = Date.now();
    results = results.filter((v) => {
      if (outlierMin || outlierMax) {
        const ratio = v.viewCount / Math.max(avgViews, 1);
        if (outlierMin && ratio < Number(outlierMin)) return false;
        if (outlierMax && ratio > Number(outlierMax)) return false;
      }
      if (viewsPerHourMin || viewsPerHourMax) {
        const hours = v.postedAt ? Math.max((now - new Date(v.postedAt).getTime()) / 3_600_000, 1) : Infinity;
        const vph = v.viewCount / hours;
        if (viewsPerHourMin && vph < Number(viewsPerHourMin)) return false;
        if (viewsPerHourMax && vph > Number(viewsPerHourMax)) return false;
      }
      return true;
    });
  }

  results =
    sort === "newest"
      ? results.sort((a, b) => new Date(b.postedAt ?? 0).getTime() - new Date(a.postedAt ?? 0).getTime())
      : results.sort((a, b) => b.viewCount - a.viewCount);

  const pageVideos = results.slice(offset, offset + limit);
  const admin = createAdminClient() as SupabaseClient;
  await backfillPageFollowerCounts(admin, pageVideos);

  return {
    videos: pageVideos,
    page,
    limit,
    hasMore: results.length > offset + limit,
  };
}

/**
 * Shared core of GET /api/niches/[niche]/videos — used by both that route
 * and the MCP `browse_niche_videos` tool so the cache-aside scrape/backfill
 * behavior stays a single implementation. `trending_videos` isn't
 * user-scoped (no per-user rows), so an admin (service-role) client is used
 * throughout rather than threading a cookie session through.
 */
export async function getNicheVideosPage(
  niche: string,
  isAllNiches: boolean,
  params: NicheVideoQueryParams
): Promise<NicheVideoPage> {
  const rawQuery = (params.q ?? "").trim();
  if (rawQuery) return searchLiveVideos(rawQuery, params);

  const admin = createAdminClient() as SupabaseClient;
  const { page, limit, style, platform, timeWindow, country, sort } = params;
  const { viewsMin, viewsMax, followersMin, followersMax, postedAfter, postedBefore } = params;
  const outlierMin = params.outlierMin ?? null;
  const outlierMax = params.outlierMax ?? null;
  const viewsPerHourMin = params.viewsPerHourMin ?? null;
  const viewsPerHourMax = params.viewsPerHourMax ?? null;
  const offset = (page - 1) * limit;
  const countries = country ? country.split(",").filter(Boolean) : [];
  const hasDerivedFilters = Boolean(outlierMin || outlierMax || viewsPerHourMin || viewsPerHourMax);

  function buildBaseQuery() {
    let query = admin.from("trending_videos").select(TRENDING_VIDEO_COLUMNS);

    if (!isAllNiches) query = query.eq("niche_category", niche);
    if (platform !== "all") query = query.eq("platform", platform);

    // TikTok rows are always tagged region='global' (SociaVault has no
    // country param) — the OR keeps them visible under a country filter
    // instead of being hidden alongside non-matching YouTube rows.
    if (countries.length > 0) query = query.or(`platform.neq.youtube,region.in.(${countries.join(",")})`);

    if (style === "ai-generated") {
      query = query.ilike("hashtag", "%ai%");
    } else if (style === "2d-animation") {
      query = query.or("hashtag.ilike.%2d%,hashtag.ilike.%animat%");
    } else if (style === "narrated") {
      query = query
        .not("hashtag", "ilike", "%ai%")
        .not("hashtag", "ilike", "%2d%")
        .not("hashtag", "ilike", "%animat%");
    }

    if (viewsMin) query = query.gte("view_count", Number(viewsMin));
    if (viewsMax) query = query.lte("view_count", Number(viewsMax));
    if (followersMin) query = query.gte("follower_count", Number(followersMin));
    if (followersMax) query = query.lte("follower_count", Number(followersMax));

    if (postedAfter || postedBefore) {
      if (postedAfter) query = query.gte("posted_at", new Date(postedAfter).toISOString());
      if (postedBefore) query = query.lte("posted_at", new Date(postedBefore).toISOString());
    } else if (TIME_WINDOW_DAYS[timeWindow]) {
      const days = TIME_WINDOW_DAYS[timeWindow];
      query = query.gte("posted_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
    }

    return sort === "newest"
      ? query.order("posted_at", { ascending: false, nullsFirst: false })
      : query.order("view_count", { ascending: false });
  }

  function applyDerivedFilters(batch: TrendingVideoRow[]): TrendingVideoRow[] {
    if (!hasDerivedFilters) return batch;
    // Approximation: "niche average" is the average view_count among this
    // same batch (already scoped to the niche + every other active filter),
    // not a separate whole-niche baseline -- avoids a second round-trip and
    // stays intuitive ("outlier vs. what you're currently looking at").
    const nicheAvgViews = batch.length > 0 ? batch.reduce((sum, r) => sum + r.view_count, 0) / batch.length : 1;
    const now = Date.now();

    return batch.filter((row) => {
      if (outlierMin || outlierMax) {
        const outlierRatio = row.view_count / Math.max(nicheAvgViews, 1);
        if (outlierMin && outlierRatio < Number(outlierMin)) return false;
        if (outlierMax && outlierRatio > Number(outlierMax)) return false;
      }
      if (viewsPerHourMin || viewsPerHourMax) {
        const hoursSincePosted = row.posted_at
          ? Math.max((now - new Date(row.posted_at).getTime()) / 3_600_000, 1)
          : Infinity;
        const viewsPerHour = row.view_count / hoursSincePosted;
        if (viewsPerHourMin && viewsPerHour < Number(viewsPerHourMin)) return false;
        if (viewsPerHourMax && viewsPerHour > Number(viewsPerHourMax)) return false;
      }
      return true;
    });
  }

  // Runs the query and returns this page's rows plus whether more exist.
  // Two shapes depending on whether outlier/views-per-hour filters are
  // active: the common case paginates in SQL via .range() (cheap, exact);
  // the derived-filter case has to pull a capped batch and paginate in JS
  // instead, since those two fields can't be expressed as column filters.
  async function runQuery(): Promise<{ pageRows: TrendingVideoRow[]; hasMore: boolean }> {
    if (hasDerivedFilters) {
      const { data, error } = await buildBaseQuery().limit(DERIVED_FILTER_BATCH_CAP);
      if (error) throw new Error(error.message);
      const filtered = applyDerivedFilters((data ?? []) as TrendingVideoRow[]);
      return {
        pageRows: filtered.slice(offset, offset + limit),
        hasMore: filtered.length > offset + limit,
      };
    }

    const { data, error } = await buildBaseQuery().range(offset, offset + limit);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as TrendingVideoRow[];
    return {
      pageRows: rows.slice(0, limit),
      hasMore: rows.length > limit,
    };
  }

  let { pageRows, hasMore } = await runQuery();

  // Cache-aside: only a specific (niche, platform) pair is backed by an
  // on-demand scrape — the "all" feed (either dimension) reads whatever's
  // already cached, since there's no single provider to refresh against a
  // blended view. Only a single selected country gets a targeted regional
  // warm-up; multi-select (or none) falls back to the global cache.
  if (!isAllNiches && platform !== "all") {
    const region = platform === "youtube" && countries.length === 1 ? countries[0] : GLOBAL_REGION;
    const ranOutOfCache = pageRows.length < limit;
    const staleFirstPage = page === 1 && (await isNicheCacheStale(admin, niche, platform, region));

    if (ranOutOfCache || staleFirstPage) {
      const wrote = await refreshNicheVideoCache(admin, niche as NicheName, platform, offset + limit, region);
      if (wrote) ({ pageRows, hasMore } = await runQuery());
    }
  } else if (isAllNiches && platform !== "all" && page === 1 && pageRows.length === 0) {
    // Blended "All niches" feed never scrapes on its own — warm a handful of
    // niches inline so a newly-picked filter isn't permanently empty.
    const region = platform === "youtube" && countries.length === 1 ? countries[0] : GLOBAL_REGION;
    await Promise.all(
      NICHE_ORDER.slice(0, ALL_NICHES_WARM_COUNT).map((n) =>
        refreshNicheVideoCache(admin, n, platform, ALL_NICHES_WARM_TARGET, region)
      )
    );
    ({ pageRows, hasMore } = await runQuery());
  }

  const videos = pageRows.map(mapTrendingVideoRow);
  await backfillPageFollowerCounts(admin, videos);

  return {
    videos,
    page,
    limit,
    hasMore,
  };
}
