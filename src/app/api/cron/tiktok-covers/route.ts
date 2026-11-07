import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { healUncopiedTikTokCovers } from "@/lib/server/tiktok-covers";
import { serverError } from "@/lib/server/api-error";

export const maxDuration = 300;

const DEFAULT_BATCH_SIZE = 150;
const MAX_BATCH_SIZE = 2000;
const HEAL_BUDGET_MS = 240_000;

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
 * Safety net behind the copy every scrape already does (see
 * tiktok-covers.ts): copies the covers of TikTok rows that still point at a
 * signed CDN link into storage before that link expires. Idempotent and
 * newest-scrape-first, so it's safe to run often or by hand to backfill:
 *
 *   curl -X POST "https://<host>/api/cron/tiktok-covers?batchSize=2000" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batchSize = parseBatchSize(request);
  try {
    const result = await healUncopiedTikTokCovers(createAdminClient(), batchSize, HEAL_BUDGET_MS);
    return NextResponse.json({ ok: true, batchSize, ...result });
  } catch (error) {
    return serverError("tiktok-covers", error);
  }
}

// Vercel Cron invokes scheduled routes with GET (see vercel.json).
export const GET = POST;
