import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  runNicheVideoBackfillTick,
  DEFAULT_NICHES_PER_TICK,
  MAX_NICHES_PER_TICK,
} from "@/lib/server/niche-video-backfill";
import type { VideoPlatform } from "@/lib/server/niche-video-refresh";
import { serverError } from "@/lib/server/api-error";

// Deep, multi-niche backfill: pulls a lot more per niche than the routine
// crons (see BACKFILL_TARGET in niche-video-backfill.ts), so a single tick
// can run long. 300s matches the ceiling already used by the other
// deep-scrape admin routes (ingest-youtube, ingest-tiktok).
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  // Vercel Cron requests carry this header automatically when deployed there;
  // fall back to a bearer token so the route can also be triggered manually
  // (local testing, or to fast-forward a cold table right now) via
  // `Authorization: Bearer $CRON_SECRET`.
  if (request.headers.get("x-vercel-cron")) return true;

  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

function parsePlatforms(request: NextRequest): VideoPlatform[] {
  const raw = request.nextUrl.searchParams.get("platform");
  if (raw === "tiktok" || raw === "youtube") return [raw];
  return ["tiktok", "youtube"];
}

function parseNichesPerTick(request: NextRequest): number {
  const raw = Number(request.nextUrl.searchParams.get("nichesPerTick"));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_NICHES_PER_TICK;
  return Math.min(MAX_NICHES_PER_TICK, Math.floor(raw));
}

/**
 * Not on the routine cron schedule in vercel.json by design -- this pulls
 * much deeper per niche than the 30min TikTok / 3h YouTube crons and is
 * meant to fast-forward a cold/empty trending_videos table, not run on a
 * tight interval indefinitely (the YouTube side in particular burns real
 * search.list quota per page: repeatedly hitting this on a short interval
 * risks the daily 10,000-unit budget). Trigger it manually a handful of
 * times to seed the table --
 *   curl -X POST https://<host>/api/cron/niche-videos-backfill \
 *     -H "Authorization: Bearer $CRON_SECRET"
 * -- then let the existing routine crons keep it warm. Each call picks the
 * coldest niches (fewest cached rows) first, so repeated calls walk the
 * whole catalog instead of hammering the same few niches.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nichesPerTick = parseNichesPerTick(request);
  const platforms = parsePlatforms(request);

  try {
    const results = await runNicheVideoBackfillTick(admin, nichesPerTick, platforms);
    const refreshedCount = results.filter((r) => r.refreshed).length;

    return NextResponse.json({
      ok: true,
      nichesTargeted: nichesPerTick,
      jobsRun: results.length,
      jobsRefreshed: refreshedCount,
      results,
    });
  } catch (error) {
    return serverError("niche-videos-backfill", error);
  }
}
