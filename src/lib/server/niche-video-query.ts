import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
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

// A cache-miss on-demand scrape (see ranOutOfCache below) can legitimately
// take up to the route's full 60s maxDuration -- a deep, high-view-floor
// YouTube scrape searching a narrow niche for e.g. 1.5M+ views in the last 7
// days is exactly the shape that runs long or comes back thin. Blocking the
// request on it end-to-end used to mean that filter combo either hung until
// the platform killed the function or ran out the clock with no response.
// This caps how long a request will wait for a same-request answer; a scrape
// still running past the cap keeps going in the background (see after()
// below) so the *next* request for the same combo benefits, instead of the
// scrape being wasted.
const ON_DEMAND_SCRAPE_SOFT_TIMEOUT_MS = 8_000;

const SOFT_TIMEOUT = Symbol("soft-timeout");

function withSoftTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof SOFT_TIMEOUT> {
  return Promise.race([
    promise,
    new Promise<typeof SOFT_TIMEOUT>((resolve) => setTimeout(() => resolve(SOFT_TIMEOUT), ms)),
  ]);
}

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
  /** True when no video actually cleared the requested view-count floor and
   * the view filter was dropped (keeping niche/platform/date/style/country
   * intact) so the closest matches could be shown instead of a blank page. */
  relaxedFilters?: boolean;
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
    // Live search hits the provider directly (SociaVault/YouTube), bypassing
    // trending_videos entirely -- these rows never go through the
    // enrichment worker, so there's no analysis to attach.
    transcriptAnalysis: null,
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
// Runs the style/view/follower/date/derived-filter pipeline and sorts the
// result, same as the inline logic below used to do -- pulled out so
// searchLiveVideos can run it twice: once with the view-count floor applied,
// and (only if that comes back empty) once without it, to power the "relax
// the view filter and show the closest matches" fallback.
function filterAndSortLiveResults(
  raw: TrendingVideo[],
  params: NicheVideoQueryParams,
  applyViewFilter: boolean
): TrendingVideo[] {
  const { style, timeWindow, sort } = params;
  const viewsMin = parseNonNegativeNumber(params.viewsMin);
  const viewsMax = parseNonNegativeNumber(params.viewsMax);
  const followersMin = parseNonNegativeNumber(params.followersMin);
  const followersMax = parseNonNegativeNumber(params.followersMax);
  const { postedAfter, postedBefore } = params;
  const outlierMin = parseNonNegativeNumber(params.outlierMin ?? null);
  const outlierMax = parseNonNegativeNumber(params.outlierMax ?? null);
  const viewsPerHourMin = parseNonNegativeNumber(params.viewsPerHourMin ?? null);
  const viewsPerHourMax = parseNonNegativeNumber(params.viewsPerHourMax ?? null);

  let results = raw;
  if (style !== "all") results = results.filter((v) => matchesStyle(v.hashtag, style));
  if (applyViewFilter) {
    if (viewsMin !== null) results = results.filter((v) => v.viewCount >= viewsMin);
    if (viewsMax !== null) results = results.filter((v) => v.viewCount <= viewsMax);
  }
  if (followersMin !== null) results = results.filter((v) => v.followerCount >= followersMin);
  if (followersMax !== null) results = results.filter((v) => v.followerCount <= followersMax);

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

  if (outlierMin !== null || outlierMax !== null || viewsPerHourMin !== null || viewsPerHourMax !== null) {
    const avgViews = results.length > 0 ? results.reduce((sum, v) => sum + v.viewCount, 0) / results.length : 1;
    const now = Date.now();
    results = results.filter((v) => {
      if (outlierMin !== null || outlierMax !== null) {
        const ratio = v.viewCount / Math.max(avgViews, 1);
        if (outlierMin !== null && ratio < outlierMin) return false;
        if (outlierMax !== null && ratio > outlierMax) return false;
      }
      if (viewsPerHourMin !== null || viewsPerHourMax !== null) {
        const hours = v.postedAt ? Math.max((now - new Date(v.postedAt).getTime()) / 3_600_000, 1) : Infinity;
        const vph = v.viewCount / hours;
        if (viewsPerHourMin !== null && vph < viewsPerHourMin) return false;
        if (viewsPerHourMax !== null && vph > viewsPerHourMax) return false;
      }
      return true;
    });
  }

  return sort === "newest"
    ? results.sort((a, b) => new Date(b.postedAt ?? 0).getTime() - new Date(a.postedAt ?? 0).getTime())
    : results.sort((a, b) => b.viewCount - a.viewCount);
}

async function searchLiveVideos(rawQuery: string, params: NicheVideoQueryParams): Promise<NicheVideoPage> {
  const { page, limit, platform, country } = params;
  const viewsMin = parseNonNegativeNumber(params.viewsMin);
  const viewsMax = parseNonNegativeNumber(params.viewsMax);
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

  const [tiktokOutcome, youtubeOutcome] = await Promise.allSettled([
    wantsTikTok
      ? mode === "hashtag"
        ? searchTikTokHashtag(term, targetCount)
        : mode === "user"
          ? searchTikTokUserVideos(term, targetCount)
          : searchTikTokKeyword(term, targetCount)
      : Promise.resolve([]),
    wantsYoutube
      ? fetchNicheYoutubeVideos([term], targetCount, countries.length > 0 ? countries : null)
      : Promise.resolve([]),
  ]);

  if (tiktokOutcome.status === "rejected") {
    console.warn(`[niche-video-query] live TikTok search ("${mode}: ${term}") failed:`, tiktokOutcome.reason);
  }
  if (youtubeOutcome.status === "rejected") {
    console.warn(`[niche-video-query] live YouTube search ("${term}") failed:`, youtubeOutcome.reason);
  }

  const raw: TrendingVideo[] = [
    ...(tiktokOutcome.status === "fulfilled" ? tiktokOutcome.value.map((v) => mapSearchResult(v, "tiktok")) : []),
    ...(youtubeOutcome.status === "fulfilled" ? youtubeOutcome.value.map((v) => mapSearchResult(v, "youtube")) : []),
  ];

  let results = filterAndSortLiveResults(raw, params, true);

  // The view floor found nothing even after scanning the full live search
  // depth -- rather than show a blank page, drop just the view-count floor
  // (every other filter stays intact) and surface the closest matches.
  let relaxedFilters = false;
  if (results.length === 0 && (viewsMin !== null || viewsMax !== null)) {
    results = filterAndSortLiveResults(raw, params, false);
    relaxedFilters = results.length > 0;
  }

  const pageVideos = results.slice(offset, offset + limit);
  const admin = createAdminClient() as SupabaseClient;
  await backfillPageFollowerCounts(admin, pageVideos);

  return {
    videos: pageVideos,
    page,
    limit,
    hasMore: results.length > offset + limit,
    relaxedFilters,
  };
}

/**
 * Shared core of GET /api/niches/[niche]/videos — used by both that route
 * and the MCP `browse_niche_videos` tool so the cache-aside scrape/backfill
 * behavior stays a single implementation. `trending_videos` isn't
 * user-scoped (no per-user rows), so an admin (service-role) client is used
 * throughout rather than threading a cookie session through.
 */
// trending_videos.view_count/follower_count are NOT NULL bigint columns (see
// the schema migrations) -- there is no NULL to accidentally exclude here.
// What *can* go wrong is a malformed query-string value (empty after
// trimming, non-numeric, negative) silently becoming NaN and getting handed
// straight to PostgREST's .gte()/.lte(), which is undefined behavior rather
// than "no filter". Parsing once, up front, and treating anything invalid as
// "filter not set" keeps every downstream .gte()/.lte() call working with a
// real finite number or not being called at all.
function parseNonNegativeNumber(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const NICHE_QUERY_DEBUG = process.env.NICHE_QUERY_DEBUG === "1";

export async function getNicheVideosPage(
  niche: string,
  isAllNiches: boolean,
  params: NicheVideoQueryParams
): Promise<NicheVideoPage> {
  const rawQuery = (params.q ?? "").trim();
  if (rawQuery) return searchLiveVideos(rawQuery, params);

  const admin = createAdminClient() as SupabaseClient;
  const { page, limit, style, platform, timeWindow, country, sort } = params;
  const { postedAfter, postedBefore } = params;
  const viewsMin = parseNonNegativeNumber(params.viewsMin);
  const viewsMax = parseNonNegativeNumber(params.viewsMax);
  const followersMin = parseNonNegativeNumber(params.followersMin);
  const followersMax = parseNonNegativeNumber(params.followersMax);
  const outlierMin = parseNonNegativeNumber(params.outlierMin ?? null);
  const outlierMax = parseNonNegativeNumber(params.outlierMax ?? null);
  const viewsPerHourMin = parseNonNegativeNumber(params.viewsPerHourMin ?? null);
  const viewsPerHourMax = parseNonNegativeNumber(params.viewsPerHourMax ?? null);
  const offset = (page - 1) * limit;
  const countries = country ? country.split(",").filter(Boolean) : [];
  const hasDerivedFilters = outlierMin !== null || outlierMax !== null || viewsPerHourMin !== null || viewsPerHourMax !== null;

  if (NICHE_QUERY_DEBUG) {
    console.log("[niche-video-query] request", {
      niche,
      isAllNiches,
      platform,
      timeWindow,
      country,
      viewsMin,
      viewsMax,
      followersMin,
      followersMax,
      postedAfter,
      postedBefore,
      style,
      sort,
    });
  }

  function buildBaseQuery(applyViewFilter = true) {
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

    if (applyViewFilter) {
      if (viewsMin !== null) query = query.gte("view_count", viewsMin);
      if (viewsMax !== null) query = query.lte("view_count", viewsMax);
    }
    if (followersMin !== null) query = query.gte("follower_count", followersMin);
    if (followersMax !== null) query = query.lte("follower_count", followersMax);

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
      if (outlierMin !== null || outlierMax !== null) {
        const outlierRatio = row.view_count / Math.max(nicheAvgViews, 1);
        if (outlierMin !== null && outlierRatio < outlierMin) return false;
        if (outlierMax !== null && outlierRatio > outlierMax) return false;
      }
      if (viewsPerHourMin !== null || viewsPerHourMax !== null) {
        const hoursSincePosted = row.posted_at
          ? Math.max((now - new Date(row.posted_at).getTime()) / 3_600_000, 1)
          : Infinity;
        const viewsPerHour = row.view_count / hoursSincePosted;
        if (viewsPerHourMin !== null && viewsPerHour < viewsPerHourMin) return false;
        if (viewsPerHourMax !== null && viewsPerHour > viewsPerHourMax) return false;
      }
      return true;
    });
  }

  // Runs the query and returns this page's rows plus whether more exist.
  // Two shapes depending on whether outlier/views-per-hour filters are
  // active: the common case paginates in SQL via .range() (cheap, exact);
  // the derived-filter case has to pull a capped batch and paginate in JS
  // instead, since those two fields can't be expressed as column filters.
  async function runQuery(applyViewFilter = true): Promise<{ pageRows: TrendingVideoRow[]; hasMore: boolean }> {
    if (hasDerivedFilters) {
      const { data, error } = await buildBaseQuery(applyViewFilter).limit(DERIVED_FILTER_BATCH_CAP);
      if (error) {
        console.error(`[niche-video-query] Supabase error (derived-filter batch, niche=${niche}, platform=${platform}):`, error);
        throw new Error(error.message);
      }
      const filtered = applyDerivedFilters((data ?? []) as TrendingVideoRow[]);
      if (NICHE_QUERY_DEBUG) {
        console.log(
          `[niche-video-query] derived-filter batch: fetched=${data?.length ?? 0} afterDerivedFilters=${filtered.length}`
        );
      }
      return {
        pageRows: filtered.slice(offset, offset + limit),
        hasMore: filtered.length > offset + limit,
      };
    }

    const { data, error } = await buildBaseQuery(applyViewFilter).range(offset, offset + limit);
    if (error) {
      console.error(`[niche-video-query] Supabase error (niche=${niche}, platform=${platform}, applyViewFilter=${applyViewFilter}):`, error);
      throw new Error(error.message);
    }
    const rows = (data ?? []) as TrendingVideoRow[];
    if (NICHE_QUERY_DEBUG) {
      console.log(
        `[niche-video-query] page query: applyViewFilter=${applyViewFilter} rawRowsReturned=${rows.length} offset=${offset} limit=${limit}`
      );
    }
    return {
      pageRows: rows.slice(0, limit),
      hasMore: rows.length > limit,
    };
  }

  if (NICHE_QUERY_DEBUG) {
    let nicheScoped = admin.from("trending_videos").select("*", { count: "exact", head: true });
    if (!isAllNiches) nicheScoped = nicheScoped.eq("niche_category", niche);
    if (platform !== "all") nicheScoped = nicheScoped.eq("platform", platform);

    const [{ count: totalCount }, { count: scopedCount }] = await Promise.all([
      admin.from("trending_videos").select("*", { count: "exact", head: true }),
      nicheScoped,
    ]);
    console.log(
      `[niche-video-query] unfiltered counts: totalTableRows=${totalCount ?? "?"} ` +
        `niche="${niche}" platform="${platform}" rowsBeforeOtherFilters=${scopedCount ?? "?"}`
    );
  }

  let { pageRows, hasMore } = await runQuery();

  // Cache-aside: only a specific (niche, platform) pair is backed by an
  // on-demand scrape — the "all" feed (either dimension) reads whatever's
  // already cached, since there's no single provider to refresh against a
  // blended view. Only a single selected country gets a targeted regional
  // warm-up; multi-select (or none) falls back to the global cache.
  let relaxedFilters = false;
  if (!isAllNiches && platform !== "all") {
    const region = platform === "youtube" && countries.length === 1 ? countries[0] : GLOBAL_REGION;
    const ranOutOfCache = pageRows.length < limit;
    const staleFirstPage = page === 1 && (await isNicheCacheStale(admin, niche, platform, region));
    const minViews = viewsMin ?? 0;

    if (ranOutOfCache) {
      // Nothing usable cached for this page -- give a real scrape a bounded
      // window to answer this request directly (the common case: most
      // niche/platform/view-floor combos resolve well under the soft
      // timeout). A scrape that's still running past it (typically a deep,
      // high-view-floor YouTube search) is hooked into after() instead of
      // awaited further, so this request falls through to the
      // relaxed-filters/possibly-empty response below rather than blocking
      // until the platform kills the function -- the next request for this
      // combo finds a warm cache instead of repeating the same slow scrape.
      const refreshPromise = refreshNicheVideoCache(
        admin,
        niche as NicheName,
        platform,
        offset + limit,
        region,
        minViews
      );
      const outcome = await withSoftTimeout(refreshPromise, ON_DEMAND_SCRAPE_SOFT_TIMEOUT_MS);
      if (outcome === SOFT_TIMEOUT) {
        after(() => refreshPromise);
      } else if (outcome) {
        ({ pageRows, hasMore } = await runQuery());
      }
    } else if (staleFirstPage) {
      // Enough cached rows to answer this request right now -- the cache is
      // just past its 24h TTL, not empty. Blocking on a fresh scrape here
      // was the actual cause of "sometimes it just hangs": every 24h, the
      // first visitor to a given niche/platform/country combo paid the full
      // scrape latency even though stale-but-fine data was sitting right
      // there. Serve what's cached immediately and refresh in the
      // background instead -- after() keeps this running past the response
      // (Vercel's waitUntil under the hood) so the *next* request benefits
      // without this one waiting on it.
      after(() => refreshNicheVideoCache(admin, niche as NicheName, platform, offset + limit, region, minViews));
    }

    // Even a full-depth scrape can legitimately find nothing above the
    // requested view-count floor for a narrow niche keyword within the
    // selected date range -- rather than leave the page blank, drop just the
    // view-count floor (niche/platform/date/style/country stay intact) and
    // surface the closest matches instead.
    if (pageRows.length === 0 && page === 1 && (viewsMin !== null || viewsMax !== null)) {
      ({ pageRows, hasMore } = await runQuery(false));
      relaxedFilters = pageRows.length > 0;
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
    relaxedFilters,
  };
}
