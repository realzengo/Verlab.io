import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapTrendingVideoRow, TRENDING_VIDEO_COLUMNS, type TrendingVideoRow } from "@/lib/server/trending-videos";
import {
  GLOBAL_REGION,
  isNicheCacheStale,
  refreshNicheVideoCache,
  type VideoPlatform,
} from "@/lib/server/niche-video-refresh";
import { isNicheName, NICHE_ORDER, type NicheName } from "@/lib/niches-catalog";

// How many niches to backfill in one shot when the "All niches" view has
// zero cached rows for the requested platform/country — e.g. a country
// nobody has filtered by yet has no cached rows anywhere, since only a
// specific-niche request scrapes (see the isAllNiches gate below). Kept
// small (unlike the cron's rotation) since this runs inline in a
// user-facing request against the 60s route timeout.
const ALL_NICHES_WARM_COUNT = 3;
const ALL_NICHES_WARM_TARGET = 30;

// Let this route run long enough to cover a real scrape (SociaVault or
// YouTube) without the platform silently killing the function mid-request
// (which used to leave the frontend spinner hanging with no response ever
// coming back). 60s is the hard cap on Vercel's Hobby tier, so it's a safe
// upper bound everywhere.
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ niche: string }> }
): Promise<NextResponse> {
  const { niche: rawNiche } = await params;
  const niche = decodeURIComponent(rawNiche);
  const isAllNiches = niche === "all";

  if (!isAllNiches && !isNicheName(niche)) {
    return NextResponse.json({ error: `Unknown niche "${niche}"` }, { status: 400 });
  }

  // Every branch below always resolves to a JSON response, even on an
  // unexpected throw — the client should never be left with a hung
  // connection and no response to react to.
  try {
    return await handleGet(request, niche, isAllNiches);
  } catch (err) {
    console.error("[niches/videos] unhandled error:", err);
    return NextResponse.json({ error: "Something went wrong loading videos." }, { status: 500 });
  }
}

async function handleGet(request: NextRequest, niche: string, isAllNiches: boolean): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
  const style = searchParams.get("style") ?? "all";
  const platformParam = searchParams.get("platform") ?? "all";
  const platform: VideoPlatform | "all" =
    platformParam === "tiktok" || platformParam === "youtube" ? platformParam : "all";
  const timeWindow = searchParams.get("timeWindow") ?? "all";
  // A YouTube regionCode (e.g. "US"); empty/omitted means worldwide. TikTok
  // has no region concept, so this only ever narrows the YouTube slice of
  // results (see the `region` filter in buildPageQuery below). Validated as
  // exactly 2 letters (not just trusted from the query string) since it gets
  // interpolated into a PostgREST `.or()` filter expression below.
  const rawCountry = (searchParams.get("country") ?? "").trim().toUpperCase();
  const country = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : "";
  const viewsMin = searchParams.get("viewsMin");
  const viewsMax = searchParams.get("viewsMax");
  const followersMin = searchParams.get("followersMin");
  const followersMax = searchParams.get("followersMax");
  const postedAfter = searchParams.get("postedAfter");
  const postedBefore = searchParams.get("postedBefore");

  // Builds (and rebuilds, after a possible backfill) the same filtered page
  // query. Fetches one extra row past `limit` so hasMore can be derived
  // from the result shape instead of a separate, slower COUNT(*) query.
  function buildPageQuery() {
    let query = supabase.from("trending_videos").select(TRENDING_VIDEO_COLUMNS);

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

    return query.order("view_count", { ascending: false }).range(offset, offset + limit);
  }

  const offset = (page - 1) * limit;
  let { data, error } = await buildPageQuery();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let rows = (data ?? []) as TrendingVideoRow[];
  let pageRows = rows.slice(0, limit);

  // Cache-aside: only a specific (niche, platform) pair is backed by an
  // on-demand scrape — the "all" feed (either dimension) reads whatever's
  // already cached, since there's no single provider to refresh against a
  // blended view. Trigger a backfill when either this page ran past the end
  // of what's cached, or — only on page 1, so we're not re-scraping on every
  // paginate — the pool has simply gone stale.
  if (!isAllNiches && platform !== "all") {
    // Only YouTube is region-scoped — a TikTok request ignores `country` and
    // always checks/refreshes the single 'global' TikTok pool.
    const region = platform === "youtube" && country ? country : GLOBAL_REGION;
    const ranOutOfCache = pageRows.length < limit;
    const staleFirstPage = page === 1 && (await isNicheCacheStale(supabase, niche, platform, region));

    if (ranOutOfCache || staleFirstPage) {
      const wrote = await refreshNicheVideoCache(
        createAdminClient(),
        niche as NicheName,
        platform,
        offset + limit,
        region
      );
      if (wrote) {
        ({ data, error } = await buildPageQuery());
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        rows = (data ?? []) as TrendingVideoRow[];
        pageRows = rows.slice(0, limit);
      }
    }
  } else if (isAllNiches && platform !== "all" && page === 1 && pageRows.length === 0) {
    // The blended "All niches" feed never scrapes on its own — it only
    // reads whatever a specific-niche request has already cached (see the
    // branch above). That leaves it permanently empty for any
    // platform/country combo nobody has viewed via a specific niche yet
    // (e.g. a country just added to the filter). Warm a handful of niches
    // inline so picking a new filter from this default view actually
    // produces something instead of silently staying empty forever.
    const region = platform === "youtube" && country ? country : GLOBAL_REGION;
    const admin = createAdminClient();
    await Promise.all(
      NICHE_ORDER.slice(0, ALL_NICHES_WARM_COUNT).map((n) =>
        refreshNicheVideoCache(admin, n, platform, ALL_NICHES_WARM_TARGET, region)
      )
    );
    ({ data, error } = await buildPageQuery());
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rows = (data ?? []) as TrendingVideoRow[];
    pageRows = rows.slice(0, limit);
  }

  return NextResponse.json({
    videos: pageRows.map(mapTrendingVideoRow),
    page,
    limit,
    hasMore: rows.length > limit,
  });
}
