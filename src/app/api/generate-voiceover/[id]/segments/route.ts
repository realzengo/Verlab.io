import { NextRequest, NextResponse } from "next/server";
import type { VoiceoverSegment } from "../../route";
import { getVoiceoverSegmentCost } from "@/lib/config/pricing";
import { chargeUser, getUserCredits } from "@/lib/server/credits";
import { generateSpeech, estimateDurationSeconds } from "@/lib/server/replicate-tts";
import { withApiLogging } from "@/lib/server/api-logging";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ensureBucket } from "@/lib/supabase/admin";
import { GENERIC_GENERATION_ERROR } from "@/lib/server/generation-error";

export const maxDuration = 60;

const STORAGE_BUCKET = "voiceovers";
const MAX_SEGMENT_CHARS = 1000;

interface AddSegmentRequestBody {
  text?: string;
}

// Generates and appends exactly one new segment to an already-completed
// generation -- the "+ Add Segment" button in the editor. Unlike the parent
// route's POST (which fans out many segments in the background via after()),
// this is a single Replicate call, fast enough to just await and respond.
async function handlePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: AddSegmentRequestBody;
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
    return NextResponse.json({ error: "Can only add a segment to a completed generation" }, { status: 400 });
  }

  const cost = getVoiceoverSegmentCost(text.length);
  const balance = await getUserCredits(user.id);
  if (balance < cost) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  const existingSegments: VoiceoverSegment[] = Array.isArray(row.segments) ? row.segments : [];

  try {
    const speech = await generateSpeech({ text, voiceId: row.voice_id, stylePrompt: row.style_prompt, languageCode: row.language_code });
    const extension = speech.contentType.includes("wav") ? "wav" : "mp3";
    const newPosition = existingSegments.length;
    const audioPath = `${user.id}/${row.id}/${newPosition}-${Date.now()}.${extension}`;

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

    const newSegment: VoiceoverSegment = { index: newPosition, text, audioPath, durationSeconds: estimateDurationSeconds(text) };
    const segments = [...existingSegments, newSegment];

    const { error: updateError } = await supabase.from("voiceover_generations").update({ segments }).eq("id", row.id).eq("user_id", user.id);
    if (updateError) {
      // The audio is already uploaded, but the row was never updated to
      // point at it -- nothing else will ever reference audioPath, so it's
      // an orphan the moment this request fails. Clean it up before
      // reporting the error, same posture as every other Storage cleanup
      // call site in this file (best-effort, logged, non-blocking).
      const { error: cleanupError } = await admin.storage.from(STORAGE_BUCKET).remove([audioPath]);
      if (cleanupError) console.error("[generate-voiceover/segments] Failed to remove orphaned storage object:", cleanupError);
      throw new Error(updateError.message);
    }

    try {
      await chargeUser(user.id, cost, "Voiceover Generation", `voiceover.${row.voice_id}.add_segment`);
    } catch (creditError) {
      console.error("[credits] Failed to deduct for added voiceover segment:", creditError);
    }

    return NextResponse.json({ segment: newSegment, position: newPosition });
  } catch (error) {
    console.error("[generate-voiceover/segments] Failed to add segment:", error);
    return NextResponse.json({ error: GENERIC_GENERATION_ERROR }, { status: 500 });
  }
}

export const POST = withApiLogging("/api/generate-voiceover/[id]/segments", handlePOST);
