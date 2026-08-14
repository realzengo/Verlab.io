import { NextRequest, NextResponse } from "next/server";
import { getVoiceOption, VOICE_PREVIEW_TEXT } from "@/lib/config/voices";
import { DEFAULT_LANGUAGE_CODE } from "@/lib/config/languages";
import { generateSpeech } from "@/lib/server/replicate-tts";
import { withApiLogging } from "@/lib/server/api-logging";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ensureBucket } from "@/lib/supabase/admin";
import { GENERIC_GENERATION_ERROR } from "@/lib/server/generation-error";

// Renders the fixed VOICE_PREVIEW_TEXT sample line for a catalog voice
// exactly once, ever -- every user hears the same clip, so it's cached in
// the public voice-previews bucket keyed by voice_id and reused for every
// future request instead of spending a fresh Replicate call per user per
// play. Requires a session purely to keep the (rare) first-render cost from
// being triggerable by anonymous traffic; the returned URL itself is public.
export const maxDuration = 120;

const STORAGE_BUCKET = "voice-previews";

function objectKey(voiceId: string): string {
  return `${voiceId}.mp3`;
}

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const voiceId = request.nextUrl.searchParams.get("voiceId");
  const voice = voiceId ? getVoiceOption(voiceId) : undefined;
  if (!voice) {
    return NextResponse.json({ error: "Unknown voiceId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const key = objectKey(voice.id);

  const existing = admin.storage.from(STORAGE_BUCKET).getPublicUrl(key);
  const head = await fetch(existing.data.publicUrl, { method: "HEAD", signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (head?.ok) {
    return NextResponse.json({ url: existing.data.publicUrl });
  }

  try {
    const speech = await generateSpeech({
      text: VOICE_PREVIEW_TEXT,
      voiceId: voice.id,
      stylePrompt: "Say the following.",
      languageCode: DEFAULT_LANGUAGE_CODE,
    });
    let { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(key, speech.bytes, { contentType: speech.contentType, upsert: true });

    // The `voice-previews` bucket may not exist yet if the migration that
    // creates it hasn't been pushed to this environment's database -- create
    // it on demand (Storage API only, no direct DB connection needed) and
    // retry once rather than failing every preview forever.
    if (uploadError && /bucket not found/i.test(uploadError.message)) {
      await ensureBucket(admin, STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"],
      });
      ({ error: uploadError } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(key, speech.bytes, { contentType: speech.contentType, upsert: true }));
    }

    if (uploadError) throw new Error(`Preview storage upload failed: ${uploadError.message}`);

    const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(key);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error("[voices/preview]", error);
    return NextResponse.json({ error: GENERIC_GENERATION_ERROR }, { status: 500 });
  }
}

export const GET = withApiLogging("/api/voices/preview", handleGET);
