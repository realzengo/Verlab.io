import { NextRequest, NextResponse } from "next/server";
import { isVoiceLibraryConfigured, searchVoiceLibrary } from "@/lib/server/elevenlabs-voices";
import { withApiLogging } from "@/lib/server/api-logging";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Searches ElevenLabs' public Voice Library for the voice picker. Returns
// `configured: false` (and no voices) when ELEVENLABS_API_KEY isn't set --
// see elevenlabs-voices.ts for why searching needs one -- so the picker can
// fall back to just the defaults plus pasting a voice id.
const MAX_SEARCH_CHARS = 100;
const MAX_PAGE = 50;

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isVoiceLibraryConfigured()) {
    return NextResponse.json({ configured: false, voices: [], hasMore: false });
  }

  if (!(await checkRateLimit(`voices-library:${user.id}`, 60, 60))) {
    return rateLimitedResponse();
  }

  const params = request.nextUrl.searchParams;
  const search = (params.get("search") ?? "").trim().slice(0, MAX_SEARCH_CHARS);
  const genderParam = params.get("gender");
  const gender = genderParam === "male" || genderParam === "female" ? genderParam : null;
  const page = Math.min(MAX_PAGE, Math.max(0, Number.parseInt(params.get("page") ?? "0", 10) || 0));

  try {
    const result = await searchVoiceLibrary({ search, gender, page });
    return NextResponse.json({ configured: true, ...result });
  } catch (error) {
    console.error("[voices/library]", error);
    return NextResponse.json({ error: "Could not load the voice library. Please try again." }, { status: 502 });
  }
}

export const GET = withApiLogging("/api/voices/library", handleGET);
