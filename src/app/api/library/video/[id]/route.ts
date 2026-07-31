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
// only client that can read a private bucket) and redirects to it.
const SIGNED_URL_TTL_SECONDS = 10 * 60;

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

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from("videos").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !signed) {
    console.error("[library/video] Failed to sign storage URL:", error);
    return NextResponse.json({ error: "Could not load video" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}

export const GET = withApiLogging("/api/library/video/[id]", handleGET);
