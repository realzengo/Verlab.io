import { NextRequest, NextResponse } from "next/server";
import { getVoiceCloneCost } from "@/lib/config/pricing";
import { chargeUser, getUserCredits } from "@/lib/server/credits";
import { createVoiceClone } from "@/lib/server/replicate-voice-clone";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ensureBucket } from "@/lib/supabase/admin";
import { VOICE_CLONING_ENABLED } from "@/lib/config/voices";
import { isValidName } from "@/lib/validation";
import { GENERIC_GENERATION_ERROR } from "@/lib/server/generation-error";

export const maxDuration = 150;

const MAX_CLONES_PER_USER = 8;
// Matches minimax/voice-cloning's own documented ceiling: "MP3, M4A, or WAV
// format, 10s to 5min duration, and less than 20MB."
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MIN_FILE_SIZE_BYTES = 1024;
// Duration (10s-5min) isn't checked here -- we'd need to decode the file
// server-side to know it, which isn't worth adding just to preempt an error
// Replicate already returns clearly on its own (surfaced via the catch below).
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

// Staging bucket for the one Replicate call in createVoiceClone() --
// minimax/voice-cloning's `voice_file` input must be a URL whose path ends
// in a real audio extension (confirmed live; see replicate-voice-clone.ts's
// module comment for what doesn't work). The uploaded sample is written
// here just long enough to hand Replicate a signed URL, then deleted --
// unlike the `voiceovers` bucket, nothing about a user's cloned-voice sample
// needs to persist once the clone itself exists on MiniMax's side.
const UPLOAD_BUCKET = "voice-clone-uploads";
const UPLOAD_SIGNED_URL_TTL_SECONDS = 10 * 60;

async function handleGET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase.from("voice_clones").select("id, name, created_at").order("created_at", { ascending: false });

  if (error) {
    return serverError("voice-clones GET", error);
  }

  return NextResponse.json({ voiceClones: data });
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  // Kill switch -- see VOICE_CLONING_ENABLED's own comment in
  // src/lib/config/voices.ts. The client already keeps the button disabled,
  // but that's not a real boundary on its own, so this route re-checks
  // before touching Replicate or the DB.
  if (!VOICE_CLONING_ENABLED) {
    return NextResponse.json({ error: "Voice cloning is temporarily unavailable. Check back soon." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`voice-clones:${user.id}`, 5, 300))) {
    return rateLimitedResponse();
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Sample is too large (max 20MB)." }, { status: 413 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const name = formData.get("name");
  const file = formData.get("file");

  if (typeof name !== "string" || !isValidName(name)) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "An audio sample is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Sample is too large (max 20MB)." }, { status: 400 });
  }
  if (file.size < MIN_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "That sample is too short to clone from." }, { status: 400 });
  }
  const extension = ALLOWED_MIME_TYPES[file.type];
  if (!extension) {
    return NextResponse.json({ error: "Unsupported file type. Upload an MP3, WAV, or M4A file." }, { status: 400 });
  }

  const { count, error: countError } = await supabase.from("voice_clones").select("id", { count: "exact", head: true });
  if (countError) {
    return serverError("voice-clones POST (count)", countError);
  }
  if ((count ?? 0) >= MAX_CLONES_PER_USER) {
    return NextResponse.json(
      { error: `You can have up to ${MAX_CLONES_PER_USER} cloned voices. Delete one before adding another.` },
      { status: 400 }
    );
  }

  const cost = getVoiceCloneCost();
  const balance = await getUserCredits(user.id);
  if (balance < cost) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  const admin = createAdminClient();
  await ensureBucket(admin, UPLOAD_BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: Object.keys(ALLOWED_MIME_TYPES),
  });

  const uploadPath = `${user.id}/${Date.now()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: stageUploadError } = await admin.storage.from(UPLOAD_BUCKET).upload(uploadPath, bytes, { contentType: file.type });
  if (stageUploadError) {
    return serverError("voice-clones POST (stage upload)", stageUploadError, "Could not process that sample");
  }

  let voiceId: string;
  try {
    const { data: signed, error: signError } = await admin.storage.from(UPLOAD_BUCKET).createSignedUrl(uploadPath, UPLOAD_SIGNED_URL_TTL_SECONDS);
    if (signError || !signed) throw new Error(signError?.message ?? "Could not sign the staged upload");

    const clone = await createVoiceClone(signed.signedUrl);
    voiceId = clone.voiceId;
  } catch (error) {
    console.error("[voice-clones] Replicate clone failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : GENERIC_GENERATION_ERROR }, { status: 500 });
  } finally {
    // Only staged to hand Replicate a URL with a real extension (see
    // UPLOAD_BUCKET's own comment) -- nothing references it once the clone
    // call above has resolved either way.
    const { error: cleanupError } = await admin.storage.from(UPLOAD_BUCKET).remove([uploadPath]);
    if (cleanupError) console.error("[voice-clones] Failed to remove staged upload (non-fatal):", cleanupError);
  }

  const { data: row, error: insertError } = await supabase
    .from("voice_clones")
    .insert({ user_id: user.id, name: name.trim(), voice_id: voiceId, credits_charged: cost })
    .select("id, name, created_at")
    .single();

  if (insertError || !row) {
    // No "delete voice" endpoint exists for a cloned MiniMax voice on
    // Replicate (see replicate-voice-clone.ts's module comment), so unlike
    // the Storage/DB cleanup pattern elsewhere in this codebase there's
    // nothing upstream to unwind here -- the clone silently becomes
    // unreachable (no DB row will ever reference its voice_id again).
    return serverError("voice-clones POST insert", insertError, "Could not save the cloned voice");
  }

  try {
    await chargeUser(user.id, cost, "Voice Cloning", `voice_clone.${row.id}`);
  } catch (creditError) {
    // Voice is already created and saved -- a ledger failure here shouldn't
    // undo that, same posture as generate-voiceover/route.ts.
    console.error("[credits] Failed to deduct for voice clone:", creditError);
  }

  return NextResponse.json({ voiceClone: row });
}

export const GET = withApiLogging("/api/voice-clones", handleGET);
export const POST = withApiLogging("/api/voice-clones", handlePOST);
