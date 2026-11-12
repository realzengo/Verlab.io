import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_VIRAL_VIEW_FLOOR,
  getCachedNicheCounts,
  mapTrendingVideoRow,
  TRENDING_VIDEO_COLUMNS,
  type TrendingVideoRow,
} from "@/lib/server/trending-videos";
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

// How many niches to warm in one shot when a cross-niche view ("All niches",
// and/or "All platforms") can't fill the requested page from cache. The old
// values (3 niches x 30 videos, and only when the page came back completely
// empty) were the single biggest reason the default view felt like it only
// knew about a sliver of the market: the default landing state IS "All
// niches + All platforms", and that combination never scraped at all. These
// warm the *coldest* niches (fewest cached rows) rather than always the
// first three in NICHE_ORDER, so repeated visits walk the whole catalog
// instead of re-warming the same head of the list.
const ALL_NICHES_WARM_COUNT = 6;
const ALL_NICHES_WARM_TARGET = 150;

// Each active filter roughly multiplies how deep a scrape has to reach for
// the surviving rows to still fill a page. 4x per filter is calibrated off
// the shape that actually starved before: faceless + a view floor + a 7-day
// window used to ask for ~60 raw rows and keep single digits.
const FILTER_SCRAPE_DEPTH_MULTIPLIER = 4;
// Backstop on a single request's scrape depth, and the one number here that's
// a budget decision rather than a safety net. The provider clients page only
// as deep as the target they're handed (they break out the moment they have
// enough -- see MAX_PAGES_PER_HASHTAG / MAX_SEARCH_PAGES), so this is what
// bounds a single page-turn's SociaVault credits and, more sharply, YouTube
// search.list quota: 100 units per 50 results against a 10,000/day budget
// means 400 is roughly 800 units worst case, the same order of magnitude the
// existing high-view-floor path (HIGH_VIEW_FLOOR_SCRAPE_TARGET) already spent.
// Raising it further trades breadth for running out of YouTube quota mid-day.
const MAX_ON_DEMAND_SCRAPE_DEPTH = 400;

// Bounds how many (niche, platform) warms run at once inside one request --
// each is a live provider call plus a chunked upsert.
const WARM_CONCURRENCY = 3;

// Outlier score, views-per-hour and "faceless only" aren't stored columns --
// they're derived in JS (see applyDerivedFilters below) rather than filtered
// in SQL, so satisfying them means scanning cached rows and keeping the
// survivors. This used to be one flat 600-row fetch, which silently made
// every derived filter a "first 600 rows only" filter: turning on "Faceless
// only" capped the entire reachable result set at whatever survived those
// 600, no matter how much matching content was cached behind them, and
// hasMore went false long before the data actually ran out. It's now a
// windowed scan that keeps pulling until it has enough survivors for the
// requested page (see runDerivedFilterScan), so paging depth is bounded by
// the data rather than by a constant.
const DERIVED_FILTER_SCAN_WINDOW = 1_000;
// Ceiling on one request's scan, purely so a filter that matches almost
// nothing can't spend the route's whole 60s budget walking the table. It
// scales with how deep the caller has paged, so it never becomes the thing
// that stops a user who is genuinely paging forward.
const DERIVED_FILTER_SCAN_BASE_ROWS = 20_000;

function derivedFilterScanBudget(offset: number, limit: number): number {
  return Math.max(DERIVED_FILTER_SCAN_BASE_ROWS, (offset + limit) * 40);
}

// Live search (the search box) hits SociaVault/YouTube directly instead of
// the cache, so its depth is real money per page-turn -- but it used to be
// pinned to the same 600-row ceiling as the cached path, which meant a
// search could never reach past ~page 30 however much the platforms had.
// Depth now grows with how deep the user has actually paged: page 1 stays
// cheap, and only someone genuinely walking forward pays for the extra
// pages.
const LIVE_SEARCH_MAX_RESULTS = 2_000;

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
   * JS, not a stored column -- see runDerivedFilterScan. */
  outlierMin?: string | null;
  outlierMax?: string | null;
  /** Views ÷ hours since posted. Same derived-in-JS treatment as outlier. */
  viewsPerHourMin?: string | null;
  viewsPerHourMax?: string | null;
  /** AI-verified "no real face on camera": the video's own transcript
   * verdict, or for a not-yet-analyzed video, whether its creator already has
   * another video judged faceless (see getFacelessAuthorSet). */
  faceless?: boolean;
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
  applyViewFilter: boolean,
  facelessAuthorSet: Set<string>
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
  if (params.faceless) {
    results = results.filter((v) => isFacelessAuthor(facelessAuthorSet, v.platform, v.author));
  }
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
  // filters below only ever shrink the pool. Grows with how deep the caller
  // has paged (rather than sitting at a flat ceiling that made ~page 30 the
  // end of every search) so page 1 stays cheap and only real forward paging
  // pays for the extra provider pages; LIVE_SEARCH_MAX_RESULTS is the
  // worst-case-spend backstop.
  const targetCount = Math.min(LIVE_SEARCH_MAX_RESULTS, Math.max(offset + limit + 60, 120));
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

  const admin = createAdminClient() as SupabaseClient;
  const facelessAuthorSet = params.faceless ? await getFacelessAuthorSet() : new Set<string>();

  let results = filterAndSortLiveResults(raw, params, true, facelessAuthorSet);

  // The view floor found nothing even after scanning the full live search
  // depth -- rather than show a blank page, drop just the view-count floor
  // (every other filter stays intact) and surface the closest matches.
  let relaxedFilters = false;
  if (results.length === 0 && (viewsMin !== null || viewsMax !== null)) {
    results = filterAndSortLiveResults(raw, params, false, facelessAuthorSet);
    relaxedFilters = results.length > 0;
  }

  const pageVideos = results.slice(offset, offset + limit);
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

// The "faceless only" filter uses each video's own transcript_analysis
// verdict when it has one -- analyzeVideoTranscript (niche-video-enrichment.ts)
// runs Gemini against that specific video's transcript on the hourly
// enrichment cron, the same signal behind the "Faceless" badge on the card.
// A video the cron hasn't reached yet falls back to its creator: if any other
// video by the same author has already been judged faceless, the channel is
// treated as faceless. That set grows on its own as the cron works through
// new scrapes, so nobody has to curate a channel list by hand.
const LEARNED_FACELESS_PAGE = 1000;

const getLearnedFacelessAuthors = unstable_cache(
  async (): Promise<string[]> => {
    const admin = createAdminClient();
    const keys = new Set<string>();
    for (let from = 0; ; from += LEARNED_FACELESS_PAGE) {
      const { data, error } = await admin
        .from("trending_videos")
        .select("platform, author")
        .eq("transcript_analysis->>status", "analyzed")
        .eq("transcript_analysis->>is_faceless", "true")
        .order("id")
        .range(from, from + LEARNED_FACELESS_PAGE - 1);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        if (row.author) keys.add(`${row.platform}::${row.author.trim().toLowerCase()}`);
      }
      if (!data || data.length < LEARNED_FACELESS_PAGE) break;
    }
    return [...keys];
  },
  ["niche-learned-faceless-authors-v1"],
  { revalidate: 3600 }
);

async function getFacelessAuthorSet(): Promise<Set<string>> {
  try {
    return new Set(await getLearnedFacelessAuthors());
  } catch (error) {
    console.error("[niche-video-query] failed to load learned faceless authors:", error);
    return new Set();
  }
}

function isFacelessAuthor(authorSet: Set<string>, platform: string, author: string): boolean {
  return authorSet.has(`${platform}::${(author ?? "").trim().toLowerCase()}`);
}

function isFacelessVideo(row: TrendingVideoRow, authorSet: Set<string>): boolean {
  const analysis = row.transcript_analysis;
  if (analysis?.status === "analyzed") return analysis.is_faceless;
  return isFacelessAuthor(authorSet, row.platform, row.author);
}

/**
 * The catalog niches with the fewest cached rows right now. A cross-niche
 * view is only ever as broad as the thinnest niches behind it, so warming
 * those is what actually widens the blended feed -- the previous behavior
 * (always the first N of NICHE_ORDER) re-warmed the same head of the list on
 * every miss and left the tail permanently thin no matter how often someone
 * browsed. Counts come from the same 5-minute-cached aggregate the sidebar
 * uses, so this costs no extra query on a warm cache.
 */
async function coldestNiches(take: number): Promise<NicheName[]> {
  try {
    const counts = await getCachedNicheCounts();
    return [...NICHE_ORDER].sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0)).slice(0, take) as NicheName[];
  } catch (err) {
    // A failed count read shouldn't cost the caller its warm-up entirely --
    // fall back to catalog order rather than warming nothing.
    console.warn("[niche-video-query] niche counts unavailable, warming in catalog order:", err);
    return NICHE_ORDER.slice(0, take) as NicheName[];
  }
}

/**
 * Warms every (niche, platform) pair behind a cross-cutting view, bounded so
 * it can't blow the route's 60s budget: pairs run WARM_CONCURRENCY at a time,
 * and the whole fan-out gets one soft-timeout window to contribute to *this*
 * request. Anything still running past that keeps going under after(), so the
 * work isn't thrown away -- the next page-turn reads a cache it already
 * deepened. Failures are per-pair and non-fatal; one dead niche shouldn't
 * take the page down with it.
 */
async function warmCrossCutCache(args: {
  admin: SupabaseClient;
  niches: NicheName[];
  platforms: VideoPlatform[];
  region: string;
  target: number;
  minViews: number;
}): Promise<void> {
  const { admin, niches, platforms, region, target, minViews } = args;
  const candidates = niches.flatMap((n) => platforms.map((pf) => ({ niche: n, platform: pf })));
  if (candidates.length === 0) return;

  // Stale-gate every pair before scraping it. Without this, a cross-cutting
  // view fans out over many niches on every under-filled page, so browsing
  // traffic alone could re-scrape the same niches every few seconds and
  // exhaust the YouTube daily quota in an afternoon. Gating on the same 24h
  // TTL the single-pair path uses caps browse-triggered warming at one
  // refresh per (niche, platform, region) per day no matter how many people
  // are looking.
  const staleness = await Promise.all(
    candidates.map(async (job) => {
      try {
        return await isNicheCacheStale(admin, job.niche, job.platform, region);
      } catch (err) {
        console.warn(`[niche-video-query] staleness check failed (${job.platform}/${job.niche}):`, err);
        return false;
      }
    })
  );
  const jobs = candidates.filter((_, i) => staleness[i]);
  if (jobs.length === 0) return;

  let nextIndex = 0;
  async function worker(): Promise<void> {
    for (let i = nextIndex++; i < jobs.length; i = nextIndex++) {
      const { niche, platform } = jobs[i];
      try {
        await refreshNicheVideoCache(admin, niche, platform, target, region, minViews);
      } catch (err) {
        console.warn(`[niche-video-query] cross-cut warm failed (${platform}/${niche}):`, err);
      }
    }
  }

  const fanOut = Promise.all(Array.from({ length: Math.min(WARM_CONCURRENCY, jobs.length) }, worker));
  if ((await withSoftTimeout(fanOut, ON_DEMAND_SCRAPE_SOFT_TIMEOUT_MS)) === SOFT_TIMEOUT) {
    after(() => fanOut);
  }
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
  const { page, limit, style, platform, timeWindow, country, sort, faceless } = params;
  const { postedAfter, postedBefore } = params;
  const requestedViewsMin = parseNonNegativeNumber(params.viewsMin);
  const viewsMax = parseNonNegativeNumber(params.viewsMax);
  // No views filter of the user's own => lead with what actually went viral
  // (see DEFAULT_VIRAL_VIEW_FLOOR) instead of whatever the scrape returned.
  // The moment they set either end of the views range themselves, their
  // filter replaces this outright -- so an applied filter always means "show
  // me everything on the market matching this", never "this, intersected with
  // a floor we didn't tell you about".
  const viewFloorIsDefault = requestedViewsMin === null && viewsMax === null;
  const viewsMin = viewFloorIsDefault ? DEFAULT_VIRAL_VIEW_FLOOR : requestedViewsMin;
  const followersMin = parseNonNegativeNumber(params.followersMin);
  const followersMax = parseNonNegativeNumber(params.followersMax);
  const outlierMin = parseNonNegativeNumber(params.outlierMin ?? null);
  const outlierMax = parseNonNegativeNumber(params.outlierMax ?? null);
  const viewsPerHourMin = parseNonNegativeNumber(params.viewsPerHourMin ?? null);
  const viewsPerHourMax = parseNonNegativeNumber(params.viewsPerHourMax ?? null);
  const offset = (page - 1) * limit;
  const countries = country ? country.split(",").filter(Boolean) : [];
  // faceless rides the same JS-side derived-filter path as outlier/vph --
  // the creator fallback can't be expressed as a column filter, so matching
  // rows are scanned and filtered in JS (see getFacelessAuthorSet/runDerivedFilterScan below)
  // rather than pushed down as a query filter.
  const hasDerivedFilters =
    outlierMin !== null || outlierMax !== null || viewsPerHourMin !== null || viewsPerHourMax !== null || faceless;
  const facelessAuthorSet = faceless ? await getFacelessAuthorSet() : new Set<string>();

  // Every filter the user actually applied, counted so scrape depth can scale
  // with how much of a raw pool the filters are about to throw away. The
  // default viral floor deliberately doesn't count -- it isn't the user
  // narrowing anything.
  const activeFilterCount =
    (requestedViewsMin !== null || viewsMax !== null ? 1 : 0) +
    (followersMin !== null || followersMax !== null ? 1 : 0) +
    (outlierMin !== null || outlierMax !== null ? 1 : 0) +
    (viewsPerHourMin !== null || viewsPerHourMax !== null ? 1 : 0) +
    (faceless ? 1 : 0) +
    (countries.length > 0 ? 1 : 0) +
    (style !== "all" ? 1 : 0) +
    (postedAfter || postedBefore || TIME_WINDOW_DAYS[timeWindow] ? 1 : 0);

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

  function buildBaseQuery(applyViewFilter = true, applyTimeWindow = true) {
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

    if (applyTimeWindow) {
      if (postedAfter || postedBefore) {
        if (postedAfter) query = query.gte("posted_at", new Date(postedAfter).toISOString());
        if (postedBefore) query = query.lte("posted_at", new Date(postedBefore).toISOString());
      } else if (TIME_WINDOW_DAYS[timeWindow]) {
        const days = TIME_WINDOW_DAYS[timeWindow];
        query = query.gte("posted_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
      }
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
      if (faceless && !isFacelessVideo(row, facelessAuthorSet)) return false;
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

  // Alternates tiktok[0], youtube[0], tiktok[1], youtube[1], ... up to
  // `limit` total, continuing from whichever platform still has rows once
  // the other runs out (a niche can legitimately have zero rows on one
  // platform -- e.g. Movie Commentary/Gaming had zero YouTube rows for a
  // while -- so this must degrade to single-platform rather than leaving
  // gaps or erroring).
  function interleaveByPlatform(
    tiktokRows: TrendingVideoRow[],
    youtubeRows: TrendingVideoRow[]
  ): TrendingVideoRow[] {
    const merged: TrendingVideoRow[] = [];
    let ti = 0;
    let yi = 0;
    while (merged.length < limit && (ti < tiktokRows.length || yi < youtubeRows.length)) {
      if (ti < tiktokRows.length) merged.push(tiktokRows[ti++]);
      if (merged.length >= limit) break;
      if (yi < youtubeRows.length) merged.push(youtubeRows[yi++]);
    }
    return merged;
  }

  // Plain "ORDER BY view_count DESC" across both platforms lets YouTube
  // dominate every page of the "All" tab -- its view counts run an order of
  // magnitude higher than TikTok's for equivalently-recent content (the
  // first TikTok row didn't show up until position 68 of a 30-day-window
  // "Most Viewed" query, confirmed against real data). Fetching each
  // platform's own page independently and interleaving them makes "All"
  // actually alternate between both instead of the higher-magnitude
  // platform crowding the other out by raw view count.
  async function runAllPlatformsQuery(
    applyViewFilter: boolean,
    applyTimeWindow: boolean
  ): Promise<{ pageRows: TrendingVideoRow[]; hasMore: boolean }> {
    const perPlatform = Math.ceil(limit / 2);
    const platformOffset = (page - 1) * perPlatform;

    const [tiktokResult, youtubeResult] = await Promise.all([
      buildBaseQuery(applyViewFilter, applyTimeWindow)
        .eq("platform", "tiktok")
        .range(platformOffset, platformOffset + perPlatform),
      buildBaseQuery(applyViewFilter, applyTimeWindow)
        .eq("platform", "youtube")
        .range(platformOffset, platformOffset + perPlatform),
    ]);

    if (tiktokResult.error) {
      console.error(`[niche-video-query] Supabase error (all-platforms tiktok half, niche=${niche}):`, tiktokResult.error);
      throw new Error(tiktokResult.error.message);
    }
    if (youtubeResult.error) {
      console.error(`[niche-video-query] Supabase error (all-platforms youtube half, niche=${niche}):`, youtubeResult.error);
      throw new Error(youtubeResult.error.message);
    }

    const tiktokRows = (tiktokResult.data ?? []) as TrendingVideoRow[];
    const youtubeRows = (youtubeResult.data ?? []) as TrendingVideoRow[];

    // Each half is only fetched `perPlatform` deep, which is correct while
    // both platforms have rows -- but when one is empty at this depth, the
    // interleave can only ever return the other's half, so an "All
    // platforms" page over a niche that's thin on one platform came back
    // half-empty (10 cards out of a 20-card page) and looked like the niche
    // had barely any content. Fall back to paginating the platform that does
    // have rows at the full page size so the page actually fills. Offsets
    // stay deterministic within a mode, so this can't duplicate or skip rows
    // as long as the thin platform stays thin.
    if (tiktokRows.length === 0 || youtubeRows.length === 0) {
      const onlyPlatform: VideoPlatform = tiktokRows.length === 0 ? "youtube" : "tiktok";
      const { data, error } = await buildBaseQuery(applyViewFilter, applyTimeWindow)
        .eq("platform", onlyPlatform)
        .range(offset, offset + limit);
      if (error) {
        console.error(
          `[niche-video-query] Supabase error (all-platforms single-platform fallback, niche=${niche}, platform=${onlyPlatform}):`,
          error
        );
        throw new Error(error.message);
      }
      const rows = (data ?? []) as TrendingVideoRow[];
      return { pageRows: rows.slice(0, limit), hasMore: rows.length > limit };
    }

    return {
      pageRows: interleaveByPlatform(tiktokRows, youtubeRows),
      hasMore: tiktokRows.length > perPlatform || youtubeRows.length > perPlatform,
    };
  }

  // Walks the ordered result set in windows, keeping only rows that survive
  // the JS-derived filters, until it has enough survivors to fill the
  // requested page (plus one, to answer hasMore honestly) or the table runs
  // out. Replaces the old single flat-capped fetch, which made every derived
  // filter silently mean "search the first 600 rows only" -- with "Faceless
  // only" on, that was the entire reachable catalog regardless of how much
  // matching content was cached behind it.
  //
  // Two things are deliberately NOT done here. It doesn't re-derive the
  // outlier baseline per window (see applyDerivedFilters): the average is
  // taken over each window as it arrives, which is the same
  // "outlier vs. what you're currently looking at" approximation the flat
  // batch already used, just now over a moving window rather than one fixed
  // 600. And it stops as soon as the page is satisfiable rather than scanning
  // to completion, so a cheap filter on page 1 still costs a single window.
  async function runDerivedFilterScan(
    applyViewFilter: boolean,
    applyTimeWindow: boolean
  ): Promise<{ pageRows: TrendingVideoRow[]; hasMore: boolean }> {
    const scanBudget = derivedFilterScanBudget(offset, limit);
    const needed = offset + limit + 1;
    const survivors: TrendingVideoRow[] = [];
    let scanned = 0;

    while (survivors.length < needed && scanned < scanBudget) {
      const window = Math.min(DERIVED_FILTER_SCAN_WINDOW, scanBudget - scanned);
      const { data, error } = await buildBaseQuery(applyViewFilter, applyTimeWindow).range(
        scanned,
        scanned + window - 1
      );
      if (error) {
        console.error(
          `[niche-video-query] Supabase error (derived-filter scan, niche=${niche}, platform=${platform}, offset=${scanned}):`,
          error
        );
        throw new Error(error.message);
      }
      const rows = (data ?? []) as TrendingVideoRow[];
      survivors.push(...applyDerivedFilters(rows));
      scanned += rows.length;
      // Short read means the ordered result set is exhausted -- every further
      // window would come back empty, so stop rather than burning round trips
      // discovering that.
      if (rows.length < window) break;
    }

    if (NICHE_QUERY_DEBUG) {
      console.log(
        `[niche-video-query] derived-filter scan: scanned=${scanned} budget=${scanBudget} survivors=${survivors.length} needed=${needed}`
      );
    }

    return {
      pageRows: survivors.slice(offset, offset + limit),
      hasMore: survivors.length > offset + limit,
    };
  }

  // Runs the query and returns this page's rows plus whether more exist.
  // Three shapes: the derived-filter case scans in windows and paginates in
  // JS (outlier/views-per-hour/faceless can't be expressed as column
  // filters -- see runDerivedFilterScan, above); the "all platforms" case
  // interleaves two independently-paged queries (see runAllPlatformsQuery,
  // above); everything else paginates in SQL via .range() (cheap, exact).
  async function runQuery(
    applyViewFilter = true,
    applyTimeWindow = true
  ): Promise<{ pageRows: TrendingVideoRow[]; hasMore: boolean }> {
    if (hasDerivedFilters) {
      return runDerivedFilterScan(applyViewFilter, applyTimeWindow);
    }

    if (platform === "all") {
      return runAllPlatformsQuery(applyViewFilter, applyTimeWindow);
    }

    const { data, error } = await buildBaseQuery(applyViewFilter, applyTimeWindow).range(offset, offset + limit);
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

  let relaxedFilters = false;

  // A derived filter (faceless, in practice) can legitimately zero out the
  // scan even though clearly-matching content exists further back in time
  // -- e.g. a channel classified faceless may have zero posts inside the
  // default 30-day window while still having dozens all-time. The
  // scrape/warm-cache fallbacks below fetch more of the *same* generic
  // content and can't fix that (they know nothing about faceless/outlier/vph),
  // so try dropping just the time window first, the same way the view-count
  // floor gets dropped further down -- niche/platform/style/faceless/view
  // filters all stay intact. Applies on every page, not just the first: a
  // relaxation that only held for page 1 meant clicking Next re-imposed the
  // window and landed on a blank page 2, which read as "there's nothing more"
  // when there demonstrably was.
  let timeWindowRelaxed = false;
  if (hasDerivedFilters && pageRows.length === 0 && (postedAfter || postedBefore || TIME_WINDOW_DAYS[timeWindow])) {
    ({ pageRows, hasMore } = await runQuery(true, false));
    relaxedFilters = pageRows.length > 0;
    timeWindowRelaxed = relaxedFilters;
  }

  // Only a single selected country gets a targeted regional warm-up;
  // multi-select (or none) falls back to the global cache.
  const region = platform === "youtube" && countries.length === 1 ? countries[0] : GLOBAL_REGION;
  // Scrape depth is "how many rows does this page need" multiplied by how
  // much the active filters are about to throw away. Sized off offset+limit
  // alone, a filtered request kept asking for ~60 raw rows and then
  // discarding nearly all of them, which is what made a filtered niche look
  // like it held a handful of videos: the pool was never deep enough for the
  // filter to have anything to find.
  const scrapeDepth = Math.min(
    MAX_ON_DEMAND_SCRAPE_DEPTH,
    (offset + limit) * (1 + activeFilterCount * FILTER_SCRAPE_DEPTH_MULTIPLIER)
  );

  if (!isAllNiches && platform !== "all") {
    // Cache-aside for one concrete (niche, platform) pair -- the only shape
    // with a single provider to refresh against.
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
        scrapeDepth,
        region,
        minViews
      );
      const outcome = await withSoftTimeout(refreshPromise, ON_DEMAND_SCRAPE_SOFT_TIMEOUT_MS);
      if (outcome === SOFT_TIMEOUT) {
        after(() => refreshPromise);
      } else if (outcome) {
        // Keep the earlier time-window relaxation (if any) in effect here --
        // a fresh scrape has no idea faceless/outlier/vph even exist, so it's
        // no more likely to land inside the strict window than the cache
        // already was, and re-imposing the window would silently throw away
        // the relaxed matches we already found.
        ({ pageRows, hasMore } = await runQuery(true, !timeWindowRelaxed));
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
      after(() => refreshNicheVideoCache(admin, niche as NicheName, platform, scrapeDepth, region, minViews));
    }
  } else if (page === 1 && pageRows.length < limit) {
    // Cross-cutting views -- "All niches", "All platforms", or both. These
    // used to read whatever happened to already be cached and never scrape,
    // on the reasoning that there's no single provider to refresh a blended
    // view against. But "All niches + All platforms" is the state every user
    // lands on, and a specific niche on "All platforms" never scraped either,
    // so in practice the default experience was capped at whatever the crons
    // had last left behind -- the core of "it's not finding all the content
    // on the platform". Warm the underlying (niche, platform) pairs instead:
    // there's no blended provider, but every pair behind the blend has one.
    // Scoped to page 1: warming brings in fresh trending rows, which is what
    // fixes "this looks empty" on arrival, but does nothing for a deep page
    // that under-fills because the cached pool genuinely ends there.
    const warmNiches = isAllNiches ? await coldestNiches(ALL_NICHES_WARM_COUNT) : [niche as NicheName];
    await warmCrossCutCache({
      admin,
      niches: warmNiches,
      platforms: platform === "all" ? ["tiktok", "youtube"] : [platform],
      region,
      target: Math.max(ALL_NICHES_WARM_TARGET, scrapeDepth),
      minViews: viewsMin ?? 0,
    });
    ({ pageRows, hasMore } = await runQuery(true, !timeWindowRelaxed));
  }

  // Even a full-depth scrape can legitimately find nothing above the
  // requested view-count floor for a narrow niche keyword within the
  // selected date range -- rather than leave the page blank, drop just the
  // view-count floor (niche/platform/date/style/country stay intact) and
  // surface the closest matches instead. Runs for every shape of query (not
  // just the single-pair one) and on every page, so paging forward through a
  // relaxed result set doesn't hit a phantom wall at page 2.
  if (pageRows.length === 0 && viewsMin !== null) {
    ({ pageRows, hasMore } = await runQuery(false, !timeWindowRelaxed));
    // Only call it out when the user set the floor themselves. Relaxing our
    // own DEFAULT_VIRAL_VIEW_FLOOR isn't a filter of theirs failing to match,
    // so saying "no videos matched your view-count filter" there would be
    // reporting on a filter they never applied.
    if (!viewFloorIsDefault) relaxedFilters = pageRows.length > 0 || relaxedFilters;
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
