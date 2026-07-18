import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchNicheTrendingVideos } from "@/lib/server/sociavault-client";
import { mapTrendingVideoRow, TRENDING_VIDEO_COLUMNS, type TrendingVideoRow } from "@/lib/server/trending-videos";
import { NICHE_HASHTAGS, isNicheName, type NicheName } from "@/lib/niches-catalog";

// Let this route run long enough to cover a real SociaVault scrape without
// the platform silently killing the function mid-request (which used to
// leave the frontend spinner hanging with no response ever coming back). 60s
// is the hard cap on Vercel's Hobby tier, so it's a safe upper bound everywhere.
export const maxDuration = 60;

// Cache-aside knobs. Unlike a flat one-time batch size, the pool a niche
// needs to satisfy a request now scales with how deep the caller has
// paginated — page 3 at limit=20 needs 60 cached rows, not a fixed 150 —
// which is what gives the "infinite" pagination feel: the cache grows on
// demand as the user keeps hitting Next, instead of being capped upfront.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BACKFILL_BUFFER = 40;
// Lock TTL: long enough to cover a full SociaVault scrape across a niche's
// hashtags, short enough that a crashed request doesn't wedge the niche for a day.
const LOCK_TTL_MS = 2 * 60 * 1000;

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function isCacheStale(
  supabase: Awaited<ReturnType<typeof createClient>>,
  niche: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("trending_videos")
    .select("refreshed_at")
    .eq("niche_category", niche)
    .order("refreshed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return true;

  return Date.now() - new Date(data.refreshed_at).getTime() >= CACHE_TTL_MS;
}

// Atomically flips this niche's lock row from idle (or abandoned-stale) to
// refreshing, so concurrent requests for the same niche don't each kick off
// their own scrape — only the request that wins the claim scrapes.
async function claimNicheRefresh(admin: SupabaseAdmin, niche: string): Promise<boolean> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TTL_MS).toISOString();

  const { data: updated, error: updateError } = await admin
    .from("niche_video_refresh_locks")
    .update({ status: "refreshing", started_at: now.toISOString() })
    .eq("niche_category", niche)
    .or(`status.eq.idle,started_at.lt.${staleBefore}`)
    .select("niche_category");

  if (!updateError && updated && updated.length > 0) return true;

  // No lock row exists yet for this niche — first-ever request. Insert one;
  // if a concurrent request beat us to it, the primary key conflict means
  // we lost the race and simply skip scraping this time.
  const { error: insertError } = await admin
    .from("niche_video_refresh_locks")
    .insert({ niche_category: niche, status: "refreshing", started_at: now.toISOString() });

  return !insertError;
}

async function releaseNicheRefresh(admin: SupabaseAdmin, niche: string): Promise<void> {
  await admin
    .from("niche_video_refresh_locks")
    .update({ status: "idle", finished_at: new Date().toISOString() })
    .eq("niche_category", niche);
}

// Returns whether new rows were actually written, so the caller knows
// whether re-querying Supabase afterward is worth doing.
async function refreshNicheCache(admin: SupabaseAdmin, niche: NicheName, targetCount: number): Promise<boolean> {
  const claimed = await claimNicheRefresh(admin, niche);
  if (!claimed) return false;

  try {
    const scraped = await fetchNicheTrendingVideos(NICHE_HASHTAGS[niche], targetCount + BACKFILL_BUFFER);
    if (scraped.length === 0) return false;

    const { error: upsertError } = await admin.from("trending_videos").upsert(
      scraped.map((v) => ({
        id: v.id,
        title: v.title,
        views: v.views,
        view_count: v.viewCount,
        like_count: v.likeCount,
        comment_count: v.commentCount,
        share_count: v.shareCount,
        follower_count: v.followerCount,
        cover_url: v.coverUrl,
        video_url: v.videoUrl,
        author: v.author,
        avatar_url: v.avatarUrl,
        hashtag: v.hashtag,
        niche_category: niche,
        region: "global",
        posted_at: v.postedAt,
        refreshed_at: new Date().toISOString(),
      })),
      { onConflict: "id" }
    );
    if (upsertError) {
      console.error("[niches/videos] upsert failed:", upsertError.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[niches/videos] SociaVault scrape failed:", err);
    return false;
  } finally {
    await releaseNicheRefresh(admin, niche);
  }
}

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
  const platform = searchParams.get("platform") ?? "all";
  const timeWindow = searchParams.get("timeWindow") ?? "all";
  const viewsMin = searchParams.get("viewsMin");
  const viewsMax = searchParams.get("viewsMax");
  const followersMin = searchParams.get("followersMin");
  const followersMax = searchParams.get("followersMax");
  const postedAfter = searchParams.get("postedAfter");
  const postedBefore = searchParams.get("postedBefore");

  // Live data is TikTok-only right now — no point querying or scraping.
  if (platform !== "all" && platform !== "tiktok") {
    return NextResponse.json({ videos: [], page, limit, hasMore: false });
  }

  // Builds (and rebuilds, after a possible backfill) the same filtered page
  // query. Fetches one extra row past `limit` so hasMore can be derived
  // from the result shape instead of a separate, slower COUNT(*) query.
  function buildPageQuery() {
    let query = supabase.from("trending_videos").select(TRENDING_VIDEO_COLUMNS);

    if (!isAllNiches) query = query.eq("niche_category", niche);

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

  // Cache-aside: only niche-scoped feeds are backed by the on-demand
  // SociaVault scrape (the "all" feed reads whatever's already cached across
  // every niche, which is always plenty). Trigger a backfill when either this
  // page ran past the end of what's cached, or — only on page 1, so we're
  // not re-scraping on every paginate — the pool has simply gone stale.
  if (!isAllNiches) {
    const ranOutOfCache = pageRows.length < limit;
    const staleFirstPage = page === 1 && (await isCacheStale(supabase, niche));

    if (ranOutOfCache || staleFirstPage) {
      const wrote = await refreshNicheCache(createAdminClient(), niche as NicheName, offset + limit);
      if (wrote) {
        ({ data, error } = await buildPageQuery());
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        rows = (data ?? []) as TrendingVideoRow[];
        pageRows = rows.slice(0, limit);
      }
    }
  }

  return NextResponse.json({
    videos: pageRows.map(mapTrendingVideoRow),
    page,
    limit,
    hasMore: rows.length > limit,
  });
}
