import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceVideoJob, type VideoJobRow } from "@/lib/server/video-jobs";

export const maxDuration = 120;

/**
 * fal's completion callback for every video job submitted with a
 * `fal_webhook` URL (see submitVideoJob in fal-video.ts). This is the
 * primary completion path; /api/cron/video-poll is the backstop for
 * missed/failed deliveries.
 *
 * Not behind Supabase auth (same as /api/webhooks/polar and
 * /api/webhooks/whop) -- fal has no session to present. Signature
 * verification (fal signs webhooks with an Ed25519 key served from a JWKS
 * endpoint) is NOT implemented here yet -- confirm the exact verification
 * flow against fal's current docs before relying on this in production, and
 * wire it in then.
 *
 * Until that's in place, this handler treats the request body as
 * UNTRUSTED beyond one field: request_id. Nothing from the payload is ever
 * used to decide a job succeeded, to price it, or to determine what got
 * stored -- advanceVideoJob() always re-derives the real status and result
 * from fal itself via our own API-key-authenticated calls
 * (checkVideoJobStatus / fetchVideoJobResult). So the worst a spoofed POST
 * can do is trigger an early, harmless re-check of a real in-flight job's
 * status -- it can't fabricate a completion, and it can't affect billing
 * for a job that hasn't actually finished on fal's side.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { request_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestId = body.request_id;
  if (!requestId) {
    return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("video_generations")
    .select("id, user_id, mode, model, fal_model_slug, fal_request_id, status, credits_quoted, credits_charged")
    .eq("fal_request_id", requestId)
    .maybeSingle<VideoJobRow>();

  if (!row) {
    // Not a request_id we recognize (stale/cleaned-up row, or noise) --
    // 200 so fal doesn't keep retrying a delivery we'll never act on.
    return NextResponse.json({ ok: true });
  }

  await advanceVideoJob(row, admin);

  return NextResponse.json({ ok: true });
}
