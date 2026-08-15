import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceVideoJob, type VideoJobRow } from "@/lib/server/video-jobs";
import { serverError } from "@/lib/server/api-error";

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
 * Backstop for /api/webhooks/replicate: actively polls Replicate for the
 * status of every video_generations row still in flight, so a job finishes
 * correctly even if Replicate's webhook delivery is dropped, delayed, or
 * never configured (e.g. local dev, where Replicate can't reach localhost
 * at all). advanceVideoJob is idempotent against a job the webhook already
 * finished (short-circuits on status/credits_charged), so this can run on a
 * tight interval without risking a double charge.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("video_generations")
    .select("id, user_id, mode, model, replicate_model, replicate_prediction_id, status, credits_quoted, credits_charged")
    .in("status", ["queued", "processing"])
    .not("replicate_prediction_id", "is", null)
    .returns<VideoJobRow[]>();

  if (error) {
    return serverError("cron/video-poll", error);
  }

  await Promise.all((rows ?? []).map((row) => advanceVideoJob(row, admin)));

  return NextResponse.json({ checked: rows?.length ?? 0 });
}
