import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceVideoJob, type VideoJobRow } from "@/lib/server/video-jobs";

export const maxDuration = 120;

/**
 * Replicate's completion callback for every video job submitted with a
 * `webhook` URL (see submitVideoJob in replicate-video.ts). This is the
 * primary completion path; /api/cron/video-poll is the backstop for
 * missed/failed deliveries. Replaces /api/webhooks/fal.
 *
 * Not behind Supabase auth (same as /api/webhooks/whop) -- Replicate has
 * no session to present. Signature
 * verification (Replicate signs webhooks per
 * https://replicate.com/docs/topics/webhooks/verify-webhook, using a
 * per-account secret from replicate.webhooks.default.secret.get()) is NOT
 * implemented here yet -- same gap the fal webhook this replaces had.
 *
 * Until that's in place, this handler treats the request body as
 * UNTRUSTED beyond one field: id (the prediction id -- Replicate's webhook
 * body is the prediction object itself). Nothing from the payload is ever
 * used to decide a job succeeded, to price it, or to determine what got
 * stored -- advanceVideoJob() always re-derives the real status and result
 * from Replicate itself via our own API-token-authenticated call
 * (getVideoJobResult). So the worst a spoofed POST can do is trigger an
 * early, harmless re-check of a real in-flight job's status -- it can't
 * fabricate a completion, and it can't affect billing for a job that hasn't
 * actually finished on Replicate's side.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const predictionId = body.id;
  if (!predictionId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("video_generations")
    .select("id, user_id, mode, model, replicate_model, replicate_prediction_id, status, credits_quoted, credits_charged")
    .eq("replicate_prediction_id", predictionId)
    .maybeSingle<VideoJobRow>();

  if (!row) {
    // Not a prediction id we recognize (stale/cleaned-up row, or noise) --
    // 200 so Replicate doesn't keep retrying a delivery we'll never act on.
    return NextResponse.json({ ok: true });
  }

  await advanceVideoJob(row, admin);

  return NextResponse.json({ ok: true });
}
