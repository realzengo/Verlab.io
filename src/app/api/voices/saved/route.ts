import { NextRequest, NextResponse } from "next/server";
import { isElevenLabsVoiceId, type ElevenLabsVoice } from "@/lib/config/elevenlabs";
import { withApiLogging } from "@/lib/server/api-logging";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ensureBucket } from "@/lib/supabase/admin";

// The voices a user hearted in the voice picker ("Saved" tab).
//
// Kept as one small JSON file per user in a private Storage bucket rather
// than a table, so the feature works on any environment without a migration
// having been pushed first (same posture as the voiceover settings stored in
// style_prompt) -- the bucket is created on demand. Each entry is the whole
// voice as the picker showed it, so the Saved tab renders without looking
// anything up again. Only this route touches the file, always as the
// signed-in user's own path.
const STORAGE_BUCKET = "user-preferences";
const MAX_SAVED = 200;

function objectPath(userId: string): string {
  return `${userId}/saved-voices.json`;
}

type Admin = ReturnType<typeof createAdminClient>;

function shortString(value: unknown, max = 120): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

// The file is only ever written from here, but entries arrive from the
// client -- keep them to the shape and sizes a real voice has. A preview URL
// is only ever played as audio, so a bundled path or an https URL.
function sanitizeVoice(raw: unknown): ElevenLabsVoice | null {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const voiceId = typeof input.voiceId === "string" ? input.voiceId : "";
  if (!isElevenLabsVoiceId(voiceId)) return null;
  const previewUrl = shortString(input.previewUrl, 600);
  return {
    voiceId,
    name: shortString(input.name, 100) ?? voiceId,
    gender: input.gender === "male" || input.gender === "female" ? input.gender : null,
    accent: shortString(input.accent, 40),
    age: shortString(input.age, 40),
    description: shortString(input.description) ?? "",
    previewUrl: previewUrl && (previewUrl.startsWith("https://") || previewUrl.startsWith("/voice-previews/")) ? previewUrl : null,
  };
}

async function readSaved(admin: Admin, userId: string): Promise<ElevenLabsVoice[]> {
  const { data, error } = await admin.storage.from(STORAGE_BUCKET).download(objectPath(userId));
  // No file yet (or no bucket yet) just means nothing saved.
  if (error || !data) return [];
  try {
    const parsed: unknown = JSON.parse(await data.text());
    return Array.isArray(parsed) ? parsed.map(sanitizeVoice).filter((v): v is ElevenLabsVoice => v !== null) : [];
  } catch {
    return [];
  }
}

async function writeSaved(admin: Admin, userId: string, voices: ElevenLabsVoice[]): Promise<void> {
  const body = JSON.stringify(voices.slice(0, MAX_SAVED));
  const upload = () => admin.storage.from(STORAGE_BUCKET).upload(objectPath(userId), body, { contentType: "application/json", upsert: true });
  let { error } = await upload();
  if (error && /bucket not found/i.test(error.message)) {
    await ensureBucket(admin, STORAGE_BUCKET, { public: false, fileSizeLimit: 1048576, allowedMimeTypes: ["application/json"] });
    ({ error } = await upload());
  }
  if (error) throw new Error(`Saving voices failed: ${error.message}`);
}

async function authedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function handleGET(): Promise<NextResponse> {
  const userId = await authedUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ voices: await readSaved(createAdminClient(), userId) });
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const userId = await authedUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await checkRateLimit(`voices-saved:${userId}`, 60, 60))) return rateLimitedResponse();

  const body = await request.json().catch(() => null);
  const voice = sanitizeVoice(body?.voice);
  if (!voice) return NextResponse.json({ error: "voice must be an ElevenLabs voice" }, { status: 400 });

  const admin = createAdminClient();
  try {
    const current = await readSaved(admin, userId);
    const voices = [voice, ...current.filter((v) => v.voiceId !== voice.voiceId)];
    await writeSaved(admin, userId, voices);
    return NextResponse.json({ voices });
  } catch (error) {
    console.error("[voices/saved POST]", error);
    return NextResponse.json({ error: "Could not save that voice. Please try again." }, { status: 500 });
  }
}

async function handleDELETE(request: NextRequest): Promise<NextResponse> {
  const userId = await authedUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await checkRateLimit(`voices-saved:${userId}`, 60, 60))) return rateLimitedResponse();

  const voiceId = request.nextUrl.searchParams.get("voiceId") ?? "";
  if (!isElevenLabsVoiceId(voiceId)) return NextResponse.json({ error: "voiceId must be an ElevenLabs voice ID" }, { status: 400 });

  const admin = createAdminClient();
  try {
    const voices = (await readSaved(admin, userId)).filter((v) => v.voiceId !== voiceId);
    await writeSaved(admin, userId, voices);
    return NextResponse.json({ voices });
  } catch (error) {
    console.error("[voices/saved DELETE]", error);
    return NextResponse.json({ error: "Could not remove that voice. Please try again." }, { status: 500 });
  }
}

export const GET = withApiLogging("/api/voices/saved", handleGET);
export const POST = withApiLogging("/api/voices/saved", handlePOST);
export const DELETE = withApiLogging("/api/voices/saved", handleDELETE);
