import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getNicheVideosPage } from "@/lib/server/niche-video-query";
import type { VideoPlatform } from "@/lib/server/niche-video-refresh";
import { isNicheName } from "@/lib/niches-catalog";
import { withApiLogging } from "@/lib/server/api-logging";
import { isPlainTextSafe, SHORT_TEXT_MAX } from "@/lib/validation";
import { requireNicheFinderAccess } from "@/lib/server/subscription";

// Let this route run long enough to cover a real scrape (SociaVault or
// YouTube) without the platform silently killing the function mid-request
// (which used to leave the frontend spinner hanging with no response ever
// coming back). 60s is the hard cap on Vercel's Hobby tier, so it's a safe
// upper bound everywhere.
export const maxDuration = 60;

async function routeGET(
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

  if (!(await requireNicheFinderAccess(supabase, user.id))) {
    return NextResponse.json({ error: "Niche Finder requires the Pro plan or higher." }, { status: 403 });
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
  // A comma-separated list of 2-letter YouTube region codes (e.g.
  // "US,CA,DE"); each entry is validated independently and invalid ones are
  // dropped rather than rejecting the whole request.
  const rawCountry = (searchParams.get("country") ?? "").trim().toUpperCase();
  const country = rawCountry
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^[A-Z]{2}$/.test(c))
    .join(",");
  const viewsMin = searchParams.get("viewsMin");
  const viewsMax = searchParams.get("viewsMax");
  const followersMin = searchParams.get("followersMin");
  const followersMax = searchParams.get("followersMax");
  const postedAfter = searchParams.get("postedAfter");
  const postedBefore = searchParams.get("postedBefore");
  const outlierMin = searchParams.get("outlierMin");
  const outlierMax = searchParams.get("outlierMax");
  const viewsPerHourMin = searchParams.get("viewsPerHourMin");
  const viewsPerHourMax = searchParams.get("viewsPerHourMax");
  const q = searchParams.get("q");
  // A non-empty q drives a live scrape/search (see getNicheVideosPage ->
  // searchLiveVideos) -- rejected outright with a 400 rather than silently
  // truncated, matching the niche-name check's "reject with a clear 400"
  // style above.
  if (q && !isPlainTextSafe(q, SHORT_TEXT_MAX)) {
    return NextResponse.json({ error: "Search query contains unsupported characters." }, { status: 400 });
  }
  const sortParam = searchParams.get("sort");
  const sort: "views" | "newest" = sortParam === "newest" ? "newest" : "views";

  const result = await getNicheVideosPage(niche, isAllNiches, {
    page,
    limit,
    style,
    platform,
    timeWindow,
    country,
    viewsMin,
    viewsMax,
    followersMin,
    followersMax,
    postedAfter,
    postedBefore,
    outlierMin,
    outlierMax,
    viewsPerHourMin,
    viewsPerHourMax,
    q,
    sort,
  });

  return NextResponse.json(result);
}

export const GET = withApiLogging("/api/niches/[niche]/videos", routeGET);
