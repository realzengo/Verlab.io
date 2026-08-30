import { NextRequest, NextResponse } from "next/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

const STORAGE_BUCKET = "videos";

// The bucket's allowed_mime_types (see the videos_bucket migration) only
// checks the Content-Type the *browser* declares on its direct-to-Storage
// PUT -- same as a spoofable Content-Type header on a normal upload, since
// these bytes never pass through this app's server to be sniffed there.
// This is the belated sniff: once the browser confirms its upload
// succeeded, pull back just the header bytes (not the whole file -- it can
// be up to 500MB) and check them against real container magic numbers
// before trusting the row as "completed".
const FTYP_OFFSET = 4;
const FTYP_MAGIC = Buffer.from("ftyp", "ascii"); // ISO-BMFF (mp4/mov)
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]); // webm/mkv
const HEADER_SNIFF_BYTES = 12;

function looksLikeVideo(header: Buffer): boolean {
  if (header.length >= FTYP_OFFSET + FTYP_MAGIC.length && header.subarray(FTYP_OFFSET, FTYP_OFFSET + FTYP_MAGIC.length).equals(FTYP_MAGIC)) {
    return true;
  }
  return header.subarray(0, EBML_MAGIC.length).equals(EBML_MAGIC);
}
// Generous sanity cap, not the real Kling-specific gate -- the actual
// 3-10.05s window is enforced against the *selected* edit model at submit
// time (see /api/generate-video/edit/route.ts), which can change after this
// upload completes, so duplicating that check here would just go stale.
const MAX_DURATION_SECONDS = 120;

/**
 * Step 1 of the client-direct-upload flow: creates the video_generations row
 * (status "queued" -- this is NOT a fal job, it's flipped to "completed" by
 * the PATCH handler below once the browser's direct-to-Storage PUT actually
 * succeeds) and mints a signed upload URL for the private "videos" bucket.
 * The browser uploads the file bytes straight to Storage with that URL,
 * never through this route -- a raw video file would blow past Vercel's
 * ~4.5MB serverless request-body limit if sent here as JSON.
 */
async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { durationSeconds?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { durationSeconds } = body;
  if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS) {
    return NextResponse.json({ error: `durationSeconds must be a number between 0 and ${MAX_DURATION_SECONDS}` }, { status: 400 });
  }

  const { data: row, error: insertError } = await supabase
    .from("video_generations")
    .insert({
      user_id: user.id,
      mode: "edit",
      operation: "uploaded",
      model: "Uploaded video",
      // No replicate_model/replicate_prediction_id -- this row is never
      // submitted to Replicate, it's just a client-direct-upload record.
      prompt: null,
      params: { durationSeconds },
      credits_quoted: 0,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error("[generate-video/edit/upload-source] Insert failed:", insertError);
    return NextResponse.json({ error: "Could not start upload" }, { status: 500 });
  }

  const path = `${user.id}/${row.id}/output.mp4`;
  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);

  if (signError || !signed) {
    console.error("[generate-video/edit/upload-source] Failed to create signed upload URL:", signError);
    await supabase.from("video_generations").update({ status: "failed", error_message: "Could not prepare upload" }).eq("id", row.id);
    return NextResponse.json({ error: "Could not prepare upload" }, { status: 500 });
  }

  await supabase.from("video_generations").update({ output_video_path: path }).eq("id", row.id);

  return NextResponse.json({ id: row.id, signedUrl: signed.signedUrl, path: signed.path, token: signed.token });
}

/** Step 2: the browser calls this once its direct-to-Storage PUT succeeds, flipping the row to "completed". */
async function handlePATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("video_generations")
    .select("id, output_video_path")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .eq("operation", "uploaded")
    .maybeSingle();

  if (!row || !row.output_video_path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(row.output_video_path, 60);

  if (signError || !signed) {
    console.error("[generate-video/edit/upload-source] Failed to sign for header sniff:", signError);
    return NextResponse.json({ error: "Could not verify upload" }, { status: 500 });
  }

  const headerResponse = await fetch(signed.signedUrl, {
    headers: { Range: `bytes=0-${HEADER_SNIFF_BYTES - 1}` },
  }).catch(() => null);

  const header = headerResponse?.ok ? Buffer.from(await headerResponse.arrayBuffer()) : null;

  if (!header || !looksLikeVideo(header)) {
    await admin.storage.from(STORAGE_BUCKET).remove([row.output_video_path]);
    await supabase
      .from("video_generations")
      .update({ status: "failed", error_message: "Uploaded file isn't a valid video." })
      .eq("id", row.id);
    return NextResponse.json({ error: "Uploaded file isn't a valid video." }, { status: 400 });
  }

  const { error: updateError } = await supabase.from("video_generations").update({ status: "completed" }).eq("id", row.id);
  if (updateError) {
    console.error("[generate-video/edit/upload-source] Failed to mark completed:", updateError);
    return NextResponse.json({ error: "Could not confirm upload" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export const POST = withApiLogging("/api/generate-video/edit/upload-source", handlePOST);
export const PATCH = withApiLogging("/api/generate-video/edit/upload-source", handlePATCH);
