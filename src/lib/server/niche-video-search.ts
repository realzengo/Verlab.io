import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapTrendingVideoRow, TRENDING_VIDEO_COLUMNS, type TrendingVideoRow } from "@/lib/server/trending-videos";
import type { VideoPlatform } from "@/lib/server/niche-video-refresh";
import type { TrendingVideo } from "@/lib/types";

export type SearchSort = "views" | "newest";

export interface NicheVideoSearchParams {
  /** niche_category, or omitted/"all" for no niche filter. */
  niche?: string | null;
  platform: VideoPlatform | "all";
  style: string;
  /** Comma-separated 2-letter YouTube region codes; empty means worldwide. */
  country: string;
  /**
   * Open-ended by design: `null`/`undefined`/`""`/the literal string
   * "INFINITY" (any case) all mean "no upper bound" and drop the `.lte()`
   * constraint entirely, so a 50M+ or 1B+ view video is never silently
   * excluded by a numeric ceiling. Same rule for followersMax.
   */
  viewsMin?: number | string | null;
  viewsMax?: number | string | null;
  followersMin?: number | string | null;
  followersMax?: number | string | null;
  postedAfter?: string | null;
  postedBefore?: string | null;
  /** Free-text match against title/author/hashtag. */
  q?: string | null;
  sort: SearchSort;
  limit: number;
  /** Opaque cursor from the previous page's `nextCursor`; omit/null for page 1. */
  cursor?: string | null;
}

export interface NicheVideoSearchPage {
  videos: TrendingVideo[];
  nextCursor: string | null;
  hasMore: boolean;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export class NicheVideoSearchError extends Error {}

// "INFINITY" (any case), null, undefined, or an empty/non-finite value all
// collapse to "no bound" -- the caller is expected to skip the corresponding
// .lte()/.gte() call entirely rather than pass this sentinel through to
// PostgREST.
function parseOpenEndedBound(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "string" && raw.trim().toUpperCase() === "INFINITY") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

interface Cursor {
  sort: SearchSort;
  // view_count for sort=views, posted_at (ISO string) or null for sort=newest.
  value: number | string | null;
  id: string;
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

// A cursor is only ever meant to be replayed against the exact query it was
// issued from (same sort). Malformed or cross-sort cursors are rejected
// rather than silently reinterpreted, since misreading one would silently
// skip or repeat rows instead of erroring visibly.
function decodeCursor(raw: string, expectedSort: SearchSort): Cursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw new NicheVideoSearchError("Invalid cursor.");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("sort" in parsed) ||
    !("value" in parsed) ||
    !("id" in parsed) ||
    (parsed as { sort: unknown }).sort !== expectedSort ||
    typeof (parsed as { id: unknown }).id !== "string"
  ) {
    throw new NicheVideoSearchError("Invalid or stale cursor for the current sort.");
  }
  return parsed as Cursor;
}

/**
 * Builds the shared filter set (niche/platform/style/country/view/follower/
 * date/text) common to every page of a given search -- called once per page
 * so the cursor's keyset predicate can be layered on top of an identical
 * base query each time.
 */
function buildFilteredQuery(admin: SupabaseClient, params: NicheVideoSearchParams) {
  const { niche, platform, style, country, postedAfter, postedBefore, q } = params;
  const viewsMin = parseOpenEndedBound(params.viewsMin);
  const viewsMax = parseOpenEndedBound(params.viewsMax);
  const followersMin = parseOpenEndedBound(params.followersMin);
  const followersMax = parseOpenEndedBound(params.followersMax);
  const countries = country ? country.split(",").filter(Boolean) : [];

  let query = admin.from("trending_videos").select(TRENDING_VIDEO_COLUMNS);

  if (niche && niche !== "all") query = query.eq("niche_category", niche);
  if (platform !== "all") query = query.eq("platform", platform);

  // TikTok rows are always tagged region='global' (SociaVault has no country
  // param) -- the OR keeps them visible under a country filter instead of
  // being hidden alongside non-matching YouTube rows.
  if (countries.length > 0) query = query.or(`platform.neq.youtube,region.in.(${countries.join(",")})`);

  if (style === "ai-generated") {
    query = query.ilike("hashtag", "%ai%");
  } else if (style === "2d-animation") {
    query = query.or("hashtag.ilike.%2d%,hashtag.ilike.%animat%");
  } else if (style === "narrated") {
    query = query.not("hashtag", "ilike", "%ai%").not("hashtag", "ilike", "%2d%").not("hashtag", "ilike", "%animat%");
  }

  // No .lte() call at all when the bound is open-ended -- this is the crux
  // of "no artificial limitations": a video with 500M views is only ever
  // excluded by an explicit, finite viewsMax the caller actually set.
  if (viewsMin !== null) query = query.gte("view_count", viewsMin);
  if (viewsMax !== null) query = query.lte("view_count", viewsMax);
  if (followersMin !== null) query = query.gte("follower_count", followersMin);
  if (followersMax !== null) query = query.lte("follower_count", followersMax);

  if (postedAfter) query = query.gte("posted_at", new Date(postedAfter).toISOString());
  if (postedBefore) query = query.lte("posted_at", new Date(postedBefore).toISOString());

  if (q && q.trim()) {
    const term = q.trim().replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`title.ilike.%${term}%,author.ilike.%${term}%,hashtag.ilike.%${term}%`);
  }

  return query;
}

// Keyset (seek) pagination instead of OFFSET: OFFSET re-scans and discards
// every prior row on each page, which gets linearly slower the deeper a
// caller pages into a large result set, and can skip/duplicate rows if the
// underlying table changes between pages (a live-refreshing cache, here).
// A composite (sort_column, id) cursor is stable under concurrent writes and
// stays O(1) relative to page depth -- the right fit for true infinite
// scrolling over an unbounded result set. `id` is always included as a
// tiebreaker since view_count/posted_at alone are not unique.
function applyCursor(
  query: ReturnType<typeof buildFilteredQuery>,
  sort: SearchSort,
  cursor: Cursor | null
) {
  if (!cursor) return query;

  if (sort === "views") {
    const v = cursor.value as number;
    return query.or(`view_count.lt.${v},and(view_count.eq.${v},id.lt.${cursor.id})`);
  }

  // sort === "newest": ordered posted_at desc, nulls last. A row already
  // past the cursor is either strictly older, tied with the cursor's own id
  // broken lexicographically, or has no posted_at at all (which always
  // sorts after every dated row in this ordering).
  if (cursor.value === null) {
    return query.is("posted_at", null).lt("id", cursor.id);
  }
  const v = cursor.value as string;
  return query.or(`posted_at.lt.${v},posted_at.is.null,and(posted_at.eq.${v},id.lt.${cursor.id})`);
}

function applyOrder(query: ReturnType<typeof buildFilteredQuery>, sort: SearchSort) {
  return sort === "newest"
    ? query.order("posted_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false })
    : query.order("view_count", { ascending: false }).order("id", { ascending: false });
}

function cursorFromRow(row: TrendingVideoRow, sort: SearchSort): Cursor {
  return {
    sort,
    value: sort === "views" ? row.view_count : row.posted_at,
    id: row.id,
  };
}

/**
 * Open-ended, cursor-paginated search over the cached `trending_videos`
 * table. Unlike getNicheVideosPage (niche-video-query.ts), this never
 * triggers a live scrape or on-demand cache refresh -- it's a pure read over
 * whatever is already cached, which is what makes true infinite scroll
 * (arbitrarily deep pages, no page-N-vs-page-N+1 consistency issues) safe to
 * offer here.
 */
export async function searchNicheVideos(
  params: NicheVideoSearchParams,
  admin: SupabaseClient = createAdminClient() as SupabaseClient
): Promise<NicheVideoSearchPage> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit || DEFAULT_LIMIT));
  const cursor = params.cursor ? decodeCursor(params.cursor, params.sort) : null;

  let query = buildFilteredQuery(admin, params);
  query = applyCursor(query, params.sort, cursor);
  query = applyOrder(query, params.sort);

  // Fetch one extra row past the page size -- its presence (not its content)
  // is what tells the caller whether a next page exists, without a separate
  // COUNT(*) round trip.
  const { data, error } = await query.limit(limit + 1);
  if (error) {
    console.error("[niche-video-search] Supabase error:", error);
    throw new NicheVideoSearchError(error.message);
  }

  const rows = (data ?? []) as TrendingVideoRow[];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows[pageRows.length - 1];

  return {
    videos: pageRows.map(mapTrendingVideoRow),
    nextCursor: hasMore && lastRow ? encodeCursor(cursorFromRow(lastRow, params.sort)) : null,
    hasMore,
  };
}
