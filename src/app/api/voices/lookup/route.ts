import { NextRequest, NextResponse } from "next/server";
import { defaultTtsSettings, getVoice, isElevenLabsVoiceId, type ElevenLabsVoice } from "@/lib/config/elevenlabs";
import { VOICE_PREVIEW_TEXT } from "@/lib/config/voices";
import { fetchVoiceMetadata } from "@/lib/server/elevenlabs-voices";
import { ElevenLabsTtsError, generateSpeech } from "@/lib/server/fal-elevenlabs-tts";
import { withApiLogging } from "@/lib/server/api-logging";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ensureBucket } from "@/lib/supabase/admin";
import { GENERIC_GENERATION_ERROR } from "@/lib/server/generation-error";

// Resolves an ElevenLabs voice id a user pasted into the voice picker into a
// selectable voice with a sample clip, and confirms fal can actually speak
// with it before the user spends credits on a generation.
//
// A default voice, or one ElevenLabs gives metadata for, comes back with
// ElevenLabs' own preview clip. Anything else (any library voice, without an
// ElevenLabs key) gets VOICE_PREVIEW_TEXT rendered through fal exactly once
// -- which doubles as the existence check -- and cached in the public
// voice-previews bucket, so a repeat lookup of the same id never renders again.
export const maxDuration = 120;

const STORAGE_BUCKET = "voice-previews";
// Cheapest fal ElevenLabs endpoint ($0.04 / 1k chars).
const PREVIEW_MODEL_ID = "eleven_v4_turbo";

function objectKey(voiceId: string): string {
  return `elevenlabs/${voiceId}.mp3`;
}

// Nothing is known about it but its id -- the picker shows the id as its name.
function customVoice(voiceId: string, previewUrl: string): ElevenLabsVoice {
  return { voiceId, name: voiceId, gender: null, accent: null, age: null, description: "", previewUrl };
}

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const voiceId = (request.nextUrl.searchParams.get("voiceId") ?? "").trim();
  if (!isElevenLabsVoiceId(voiceId)) {
    return NextResponse.json({ error: "That doesn't look like an ElevenLabs voice ID (20 letters and numbers)" }, { status: 400 });
  }

  const preset = getVoice(voiceId);
  if (preset) return NextResponse.json({ voice: preset });

  if (!(await checkRateLimit(`voices-lookup:${user.id}`, 10, 60))) {
    return rateLimitedResponse();
  }

  const described = await fetchVoiceMetadata(voiceId);
  if (described?.previewUrl) return NextResponse.json({ voice: described });

  const admin = createAdminClient();
  const key = objectKey(voiceId);
  const existing = admin.storage.from(STORAGE_BUCKET).getPublicUrl(key).data.publicUrl;
  const head = await fetch(existing, { method: "HEAD", signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (head?.ok) {
    return NextResponse.json({ voice: described ? { ...described, previewUrl: existing } : customVoice(voiceId, existing) });
  }

  try {
    const speech = await generateSpeech({
      text: VOICE_PREVIEW_TEXT,
      voiceId,
      settings: { ...defaultTtsSettings(), modelId: PREVIEW_MODEL_ID, voiceName: voiceId },
    });

    let { error: uploadError } = await admin.storage.from(STORAGE_BUCKET).upload(key, speech.bytes, { contentType: speech.contentType, upsert: true });
    // The bucket may not exist yet if its migration hasn't been pushed to
    // this environment -- create it on demand and retry once.
    if (uploadError && /bucket not found/i.test(uploadError.message)) {
      await ensureBucket(admin, STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"],
      });
      ({ error: uploadError } = await admin.storage.from(STORAGE_BUCKET).upload(key, speech.bytes, { contentType: speech.contentType, upsert: true }));
    }
    if (uploadError) throw new Error(`Preview storage upload failed: ${uploadError.message}`);

    return NextResponse.json({ voice: described ? { ...described, previewUrl: existing } : customVoice(voiceId, existing) });
  } catch (error) {
    if (error instanceof ElevenLabsTtsError && error.voiceNotFound) {
      return NextResponse.json({ error: "No ElevenLabs voice has that ID" }, { status: 404 });
    }
    console.error("[voices/lookup]", error);
    return NextResponse.json({ error: GENERIC_GENERATION_ERROR }, { status: 500 });
  }
}

export const GET = withApiLogging("/api/voices/lookup", handleGET);
