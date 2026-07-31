import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceVideoJob, type VideoJobRow } from "@/lib/server/video-jobs";

export const maxDuration = 120;

// Same auth pattern as /api/cron/health-check -- Vercel Cron requests carry
// x-vercel-cron automatically; the bearer fallback lets this be triggered
// manually (local testing, a different scheduler). Registered in
// vercel.json.
function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron")) return true;

  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

/**
 * Backstop for /api/webhooks/fal: actively polls fal for the status of
 * every video_generations row still in flight, so a job finishes correctly
 * even if fal's webhook delivery is dropped, delayed, or never configured
 * (e.g. local dev, where fal can't reach localhost at all -- see the plan's
 * verification notes). advanceVideoJob is idempotent against a job the
 * webhook already finished (short-circuits on status/credits_charged), so
 * this can run on a tight interval without risking a double charge.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("video_generations")
    .select("id, user_id, mode, model, fal_model_slug, fal_request_id, status, credits_quoted, credits_charged")
    .in("status", ["queued", "processing"])
    .not("fal_request_id", "is", null)
    .returns<VideoJobRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await Promise.all((rows ?? []).map((row) => advanceVideoJob(row, admin)));

  return NextResponse.json({ checked: rows?.length ?? 0 });
}
