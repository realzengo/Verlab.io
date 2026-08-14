import { NextRequest, NextResponse } from "next/server";
import type { VoiceoverSegment } from "../../../route";
import { getVoiceoverSegmentCost } from "@/lib/config/pricing";
import { chargeUser, getUserCredits } from "@/lib/server/credits";
import { generateSpeech, estimateDurationSeconds } from "@/lib/server/replicate-tts";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ensureBucket } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";
import { GENERIC_GENERATION_ERROR } from "@/lib/server/generation-error";

// Signed-URL playback, same pattern as /api/library/video/[id]: the
// voiceovers Storage bucket is private, so this is the only way a segment's
// audio bytes become reachable. `index` is the segment's position in the
// row's `segments` array (matches /api/library/image/[id]/[index]'s
// convention), not the `index` field persisted inside each segment object.
const STORAGE_BUCKET = "voiceovers";
const SIGNED_URL_TTL_SECONDS = 10 * 60;
const MAX_SEGMENT_CHARS = 1000;

interface RegenerateSegmentRequestBody {
  text?: string;
}

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

// Re-runs TTS for exactly one already-generated segment with edited text,
// replacing its audio in place -- the "Voiceover editor" tab's per-segment
// regenerate button. Same single-Replicate-call posture as the sibling
// POST (add segment) in ../route.ts.
async function handlePATCH(
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

  let body: RegenerateSegmentRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > MAX_SEGMENT_CHARS) {
    return NextResponse.json({ error: `text must be ${MAX_SEGMENT_CHARS} characters or fewer` }, { status: 400 });
  }

  const { data: row, error: fetchError } = await supabase
    .from("voiceover_generations")
    .select("id, status, voice_id, style_prompt, language_code, segments")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status !== "completed") {
    return NextResponse.json({ error: "Can only regenerate a segment on a completed generation" }, { status: 400 });
  }

  const segments: VoiceoverSegment[] = Array.isArray(row.segments) ? row.segments : [];
  const targetIndex = Number(index);
  const target = segments[targetIndex];
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cost = getVoiceoverSegmentCost(text.length);
  const balance = await getUserCredits(user.id);
  if (balance < cost) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  try {
    const speech = await generateSpeech({ text, voiceId: row.voice_id, stylePrompt: row.style_prompt, languageCode: row.language_code });
    const extension = speech.contentType.includes("wav") ? "wav" : "mp3";
    // Timestamped, distinct from the old path -- upload the new take before
    // touching the DB row or removing the old object, so a failed upload
    // never leaves the row pointing at audio that no longer exists.
    const audioPath = `${user.id}/${row.id}/${targetIndex}-${Date.now()}.${extension}`;

    const admin = createAdminClient();
    await ensureBucket(admin, STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: 26214400,
      allowedMimeTypes: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"],
    });
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(audioPath, speech.bytes, { contentType: speech.contentType, upsert: true });
    if (uploadError) throw new Error(`Voiceover storage upload failed: ${uploadError.message}`);

    const updatedSegment: VoiceoverSegment = { index: targetIndex, text, audioPath, durationSeconds: estimateDurationSeconds(text) };
    const updatedSegments = segments.map((s, i) => (i === targetIndex ? updatedSegment : s));

    const { error: updateError } = await supabase
      .from("voiceover_generations")
      .update({ segments: updatedSegments })
      .eq("id", row.id)
      .eq("user_id", user.id);
    if (updateError) throw new Error(updateError.message);

    if (target.audioPath && target.audioPath !== audioPath) {
      const { error: removeError } = await admin.storage.from(STORAGE_BUCKET).remove([target.audioPath]);
      // The row already points at the new take -- an orphaned old object is
      // cleaned up later, same posture as handleDELETE above.
      if (removeError) console.error("[generate-voiceover/segments] Failed to remove old storage object (non-fatal):", removeError);
    }

    try {
      await chargeUser(user.id, cost, "Voiceover Generation", `voiceover.${row.voice_id}.regenerate_segment`);
    } catch (creditError) {
      console.error("[credits] Failed to deduct for regenerated voiceover segment:", creditError);
    }

    return NextResponse.json({ segment: updatedSegment });
  } catch (error) {
    console.error("[generate-voiceover/segments] Failed to regenerate segment:", error);
    return NextResponse.json({ error: GENERIC_GENERATION_ERROR }, { status: 500 });
  }
}

export const GET = withApiLogging("/api/generate-voiceover/[id]/segments/[index]", handleGET);
export const DELETE = withApiLogging("/api/generate-voiceover/[id]/segments/[index]", handleDELETE);
export const PATCH = withApiLogging("/api/generate-voiceover/[id]/segments/[index]", handlePATCH);
