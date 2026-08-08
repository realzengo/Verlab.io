import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";

// Signed-URL playback -- videos live in a PRIVATE Storage bucket (see
// 20260731150001_videos_bucket.sql), unlike avatars, so there is no bare
// public URL to hand the <video> tag directly. This route is the only way
// a video's bytes become reachable: it checks row ownership via the
// session-scoped client (RLS on video_generations enforces auth.uid() =
// user_id, same as /api/downloads/file/[id] relies on for `downloads`),
// then mints a short-lived signed URL with the service-role client (the
// only client that can read a private bucket).
//
// Proxied rather than redirected: a redirect hands the browser a
// freshly-tokened signed URL every request, which is a guaranteed cache
// miss (different URL each time) -- that's why "Recent Generations" tiles
// re-fetched their video from scratch, black-frame flash and all, on every
// mount/refresh. Fetching the bytes here and returning them under the
// stable `/api/library/video/[id]` URL with an immutable Cache-Control
// (matching /api/library/image/[id]/[index]'s existing convention) lets
// the browser cache them for real, so a revisited generation loads
// instantly from disk instead of re-downloading. Range is forwarded both
// ways so seeking/scrubbing still works.
const SIGNED_URL_TTL_SECONDS = 10 * 60;

const STORAGE_BUCKET = "videos";

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("video_generations")
    .select("status, output_video_path, thumbnail_path")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const wantsThumbnail = request.nextUrl.searchParams.get("variant") === "thumbnail";
  const path = wantsThumbnail ? data.thumbnail_path : data.output_video_path;

  if (data.status !== "completed" || !path) {
    return NextResponse.json({ error: "That video isn't ready yet" }, { status: 400 });
  }

  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !signed) {
    console.error("[library/video] Failed to sign storage URL:", error);
    return NextResponse.json({ error: "Could not load video" }, { status: 500 });
  }

  const range = request.headers.get("range");
  const upstream = await fetch(signed.signedUrl, range ? { headers: { Range: range } } : undefined);
  if (!upstream.ok || !upstream.body) {
    console.error("[library/video] Upstream fetch failed:", upstream.status);
    return NextResponse.json({ error: "Could not load video" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  // Same reasoning as the image route's identical header: generated video
  // output is immutable once written, safe to cache hard on the client.
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  if (wantsDownload) headers.set("Content-Disposition", `attachment; filename="clypa-${id}.mp4"`);

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

// Deletes both the DB row and its Storage objects. Ownership is checked
// explicitly (not just left to RLS) so the 404 path is unambiguous, same
// belt-and-suspenders style as /api/library/image/[id]/[index]'s DELETE.
async function handleDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("video_generations")
    .select("output_video_path, thumbnail_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("video_generations").delete().eq("id", id).eq("user_id", user.id);
  if (deleteError) {
    console.error("[library/video] Failed to delete row:", deleteError);
    return NextResponse.json({ error: "Could not delete video" }, { status: 500 });
  }

  const paths = [data.output_video_path, data.thumbnail_path].filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    const admin = createAdminClient();
    const { error: storageError } = await admin.storage.from(STORAGE_BUCKET).remove(paths);
    // The DB row is already gone -- a leftover Storage object is an orphan
    // to clean up later, not a reason to report the delete as failed.
    if (storageError) console.error("[library/video] Failed to remove storage objects (non-fatal):", storageError);
  }

  return NextResponse.json({ success: true });
}

export const GET = withApiLogging("/api/library/video/[id]", handleGET);
export const DELETE = withApiLogging("/api/library/video/[id]", handleDELETE);
