import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GLOBAL_REGION, refreshNicheVideoCache } from "@/lib/server/niche-video-refresh";
import { NICHE_ORDER, type NicheName } from "@/lib/niches-catalog";
import { serverError } from "@/lib/server/api-error";

function isAuthorized(request: NextRequest): boolean {
  // Vercel Cron requests carry this header automatically when deployed there;
  // fall back to a bearer token so the route can also be triggered manually
  // (local testing, a different scheduler) via `Authorization: Bearer $CRON_SECRET`.
  if (request.headers.get("x-vercel-cron")) return true;

  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

// YouTube search.list costs 100 quota units per niche keyword against
// Google's default 10,000/day budget, so — unlike TikTok's cheap, frequent
// full-pool refresh — this can't just re-scrape everything on every tick.
// Instead each tick refreshes only the few niches whose pool is stalest,
// which turns a string of small, cheap ticks into a full rotation across
// every niche over the course of a day while leaving headroom for the
// on-demand cache-aside refresh in /api/niches/[niche]/videos to also fire.
const NICHES_PER_TICK = 2;
const TARGET_COUNT_PER_NICHE = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Scoped to the worldwide pool — this tick only ever refreshes
  // GLOBAL_REGION (see the refreshNicheVideoCache call below); country-scoped
  // pools are refreshed lazily on-demand instead, so mixing their timestamps
  // into this ranking would skew which niche looks "stalest".
  const { data: rows, error } = await admin
    .from("trending_videos")
    .select("niche_category, refreshed_at")
    .eq("platform", "youtube")
    .eq("region", GLOBAL_REGION);

  if (error) {
    return serverError("youtube-videos/refresh", error);
  }

  // Niches with no YouTube rows yet have never been refreshed — they sort
  // first (timestamp 0) so a brand-new niche gets its first pool before any
  // niche gets a second refresh.
  const lastRefreshedByNiche = new Map<string, number>();
  for (const row of rows ?? []) {
    if (!row.niche_category) continue;
    const refreshedAt = new Date(row.refreshed_at).getTime();
    const existing = lastRefreshedByNiche.get(row.niche_category);
    if (existing === undefined || refreshedAt > existing) {
      lastRefreshedByNiche.set(row.niche_category, refreshedAt);
    }
  }

  const rankedNiches = [...NICHE_ORDER].sort(
    (a, b) => (lastRefreshedByNiche.get(a) ?? 0) - (lastRefreshedByNiche.get(b) ?? 0)
  );
  const targetNiches = rankedNiches.slice(0, NICHES_PER_TICK) as NicheName[];

  const results = await Promise.all(
    targetNiches.map(async (niche) => ({
      niche,
      refreshed: await refreshNicheVideoCache(admin, niche, "youtube", TARGET_COUNT_PER_NICHE),
    }))
  );

  return NextResponse.json({ ok: true, results });
}
