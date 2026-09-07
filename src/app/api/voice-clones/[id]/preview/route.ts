import { NextRequest, NextResponse } from "next/server";
import { VOICE_PREVIEW_TEXT, VOICE_CLONING_ENABLED } from "@/lib/config/voices";
import { generateSpeechForClonedVoice } from "@/lib/server/replicate-voice-clone-tts";
import { withApiLogging } from "@/lib/server/api-logging";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { GENERIC_GENERATION_ERROR } from "@/lib/server/generation-error";

export const maxDuration = 90;

// Unlike /api/voices/preview (one fixed clip per catalog voice, cached
// forever in a public bucket -- every user hears the same thing), a cloned
// voice is private and per-user, so there's no shared object to cache: this
// renders VOICE_PREVIEW_TEXT fresh on each request and streams the audio
// bytes straight back rather than returning a Storage URL.
async function handleGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!VOICE_CLONING_ENABLED) {
    return NextResponse.json({ error: "Voice cloning is temporarily unavailable. Check back soon." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`voice-clones-preview:${user.id}`, 20, 60))) {
    return rateLimitedResponse();
  }

  const { data: row } = await supabase.from("voice_clones").select("voice_id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const speech = await generateSpeechForClonedVoice(row.voice_id, VOICE_PREVIEW_TEXT);
    return new NextResponse(Buffer.from(speech.bytes), {
      headers: { "Content-Type": speech.contentType, "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    console.error("[voice-clones/preview]", error);
    return NextResponse.json({ error: GENERIC_GENERATION_ERROR }, { status: 500 });
  }
}

export const GET = withApiLogging("/api/voice-clones/[id]/preview", handleGET);
