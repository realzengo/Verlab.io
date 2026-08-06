import { NextRequest, NextResponse } from "next/server";
import type { VoiceoverSegment } from "../../../route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";

// Signed-URL playback, same pattern as /api/library/video/[id]: the
// voiceovers Storage bucket is private, so this is the only way a segment's
// audio bytes become reachable. `index` is the segment's position in the
// row's `segments` array (matches /api/library/image/[id]/[index]'s
// convention), not the `index` field persisted inside each segment object.
const STORAGE_BUCKET = "voiceovers";
const SIGNED_URL_TTL_SECONDS = 10 * 60;

async function loadRowSegments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  userId: string
): Promise<VoiceoverSegment[] | null> {
  const { data } = await supabase.from("voiceover_generations").select("segments").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return Array.isArray(data.segments) ? data.segments : [];
}

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
): Promise<NextResponse> {
  const { id, index } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const segments = await loadRowSegments(supabase, id, user.id);
  const segment = segments?.[Number(index)];
  if (!segment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(segment.audioPath, SIGNED_URL_TTL_SECONDS);

  if (error || !signed) {
    console.error("[generate-voiceover/segments] Failed to sign storage URL:", error);
    return NextResponse.json({ error: "Could not load audio" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}

async function handleDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
): Promise<NextResponse> {
  const { id, index } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const segments = await loadRowSegments(supabase, id, user.id);
  const targetIndex = Number(index);
  const segment = segments?.[targetIndex];
  if (!segments || !segment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const remaining = segments.filter((_, i) => i !== targetIndex);

  const { error: updateError } = await supabase
    .from("voiceover_generations")
    .update({ segments: remaining })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const admin = createAdminClient();
  const { error: storageError } = await admin.storage.from(STORAGE_BUCKET).remove([segment.audioPath]);
  // The row is already updated -- a leftover Storage object is an orphan to
  // clean up later, not a reason to report the delete as failed (same
  // posture as /api/library/video/[id]'s DELETE).
  if (storageError) console.error("[generate-voiceover/segments] Failed to remove storage object (non-fatal):", storageError);

  return NextResponse.json({ ok: true });
}

export const GET = withApiLogging("/api/generate-voiceover/[id]/segments/[index]", handleGET);
export const DELETE = withApiLogging("/api/generate-voiceover/[id]/segments/[index]", handleDELETE);
