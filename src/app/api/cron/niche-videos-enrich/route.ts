import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runNicheVideoEnrichmentTick } from "@/lib/server/niche-video-enrichment";
import { serverError } from "@/lib/server/api-error";

// Matches the ceiling niche-videos-backfill/route.ts uses for the same
// reason: a transcript fetch + Gemini pass per video, run across a batch,
// can legitimately take a while.
export const maxDuration = 300;

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;

function isAuthorized(request: NextRequest): boolean {
  // Vercel Cron requests carry this header automatically when deployed there;
  // fall back to a bearer token so the route can also be triggered manually.
  if (request.headers.get("x-vercel-cron")) return true;

  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

function parseBatchSize(request: NextRequest): number {
  const raw = Number(request.nextUrl.searchParams.get("batchSize"));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_BATCH_SIZE;
  return Math.min(MAX_BATCH_SIZE, Math.floor(raw));
}

/**
 * Keeps trending_videos.transcript_analysis filled in behind the scrape
 * crons -- every fresh row lands with transcript_analysis NULL, and this is
 * the only thing that ever clears it (see niche-video-enrichment.ts for the
 * queue query and per-video enrichment logic). Idempotent and
 * self-prioritizing (oldest-unanalyzed-first), so it's safe to run on a
 * tight interval; each tick only ever claims rows still sitting at NULL.
 *
 *   curl -X POST https://<host>/api/cron/niche-videos-enrich \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const batchSize = parseBatchSize(request);

  try {
    const result = await runNicheVideoEnrichmentTick(admin, batchSize);
    return NextResponse.json({ ok: true, batchSize, ...result });
  } catch (error) {
    return serverError("niche-videos-enrich", error);
  }
}
