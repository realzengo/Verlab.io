import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapTrendingVideoRow, TRENDING_VIDEO_COLUMNS, type TrendingVideoRow } from "@/lib/server/trending-videos";
import {
  GLOBAL_REGION,
  isNicheCacheStale,
  refreshNicheVideoCache,
  type VideoPlatform,
} from "@/lib/server/niche-video-refresh";
import { NICHE_ORDER, type NicheName } from "@/lib/niches-catalog";
import type { TrendingVideo } from "@/lib/types";

// How many niches to backfill in one shot when the "All niches" view has
// zero cached rows for the requested platform/country.
const ALL_NICHES_WARM_COUNT = 3;
const ALL_NICHES_WARM_TARGET = 30;

export interface NicheVideoQueryParams {
  page: number;
  limit: number;
  style: string;
  platform: VideoPlatform | "all";
  timeWindow: string;
  country: string;
  viewsMin: string | null;
  viewsMax: string | null;
  followersMin: string | null;
  followersMax: string | null;
  postedAfter: string | null;
  postedBefore: string | null;
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
  const admin = createAdminClient() as SupabaseClient;
  const { page, limit, style, platform, timeWindow, country, q, sort } = params;
  const { viewsMin, viewsMax, followersMin, followersMax, postedAfter, postedBefore } = params;
  const offset = (page - 1) * limit;

  // PostgREST's .or() splits on "," and treats "(" / ")" as grouping, so
  // strip them from the raw search term rather than trying to escape them --
  // a search for "foo,bar" just becomes "foobar" instead of corrupting the
  // filter expression or throwing.
  const sanitizedQuery = (q ?? "").trim().replace(/[,()]/g, "");

  function buildPageQuery() {
    let query = admin.from("trending_videos").select(TRENDING_VIDEO_COLUMNS);

    if (!isAllNiches) query = query.eq("niche_category", niche);
    if (platform !== "all") query = query.eq("platform", platform);

    // TikTok rows are always tagged region='global' (SociaVault has no
    // country param) — the OR keeps them visible under a country filter
    // instead of being hidden alongside non-matching YouTube rows.
    if (country) query = query.or(`platform.neq.youtube,region.eq.${country}`);

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
    } else if (timeWindow === "7d" || timeWindow === "30d") {
      const days = timeWindow === "7d" ? 7 : 30;
      query = query.gte("posted_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
    }

    if (sanitizedQuery) {
      query = query.or(
        `title.ilike.%${sanitizedQuery}%,author.ilike.%${sanitizedQuery}%,hashtag.ilike.%${sanitizedQuery}%`
      );
    }

    query =
      sort === "newest"
        ? query.order("posted_at", { ascending: false, nullsFirst: false })
        : query.order("view_count", { ascending: false });

    return query.range(offset, offset + limit);
  }

  let { data, error } = await buildPageQuery();
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as TrendingVideoRow[];
  let pageRows = rows.slice(0, limit);

  // Cache-aside: only a specific (niche, platform) pair is backed by an
  // on-demand scrape — the "all" feed (either dimension) reads whatever's
  // already cached, since there's no single provider to refresh against a
  // blended view.
  if (!isAllNiches && platform !== "all") {
    const region = platform === "youtube" && country ? country : GLOBAL_REGION;
    const ranOutOfCache = pageRows.length < limit;
    const staleFirstPage = page === 1 && (await isNicheCacheStale(admin, niche, platform, region));

    if (ranOutOfCache || staleFirstPage) {
      const wrote = await refreshNicheVideoCache(admin, niche as NicheName, platform, offset + limit, region);
      if (wrote) {
        ({ data, error } = await buildPageQuery());
        if (error) throw new Error(error.message);
        rows = (data ?? []) as TrendingVideoRow[];
        pageRows = rows.slice(0, limit);
      }
    }
  } else if (isAllNiches && platform !== "all" && page === 1 && pageRows.length === 0) {
    // Blended "All niches" feed never scrapes on its own — warm a handful of
    // niches inline so a newly-picked filter isn't permanently empty.
    const region = platform === "youtube" && country ? country : GLOBAL_REGION;
    await Promise.all(
      NICHE_ORDER.slice(0, ALL_NICHES_WARM_COUNT).map((n) =>
        refreshNicheVideoCache(admin, n, platform, ALL_NICHES_WARM_TARGET, region)
      )
    );
    ({ data, error } = await buildPageQuery());
    if (error) throw new Error(error.message);
    rows = (data ?? []) as TrendingVideoRow[];
    pageRows = rows.slice(0, limit);
  }

  return {
    videos: pageRows.map(mapTrendingVideoRow),
    page,
    limit,
    hasMore: rows.length > limit,
  };
}
