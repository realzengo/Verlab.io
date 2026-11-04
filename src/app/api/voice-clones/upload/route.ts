import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { CLONE_SAMPLE_EXTENSIONS, CLONE_SAMPLE_MAX_BYTES, CLONE_SAMPLE_TYPES, VOICE_CLONING_ENABLED } from "@/lib/config/voices";
import { withApiLogging } from "@/lib/server/api-logging";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ensureBucket } from "@/lib/supabase/admin";
import { SAMPLE_BUCKET } from "@/lib/server/voice-clones";

// Step 1 of cloning: a one-time signed upload URL so the browser sends the
// sample straight to Storage. A sample can be up to 20MB, well past
// Vercel's serverless request-body limit, so it never passes through this
// app's server (same pattern as /api/generate-video/edit/upload-source).
// POST /api/voice-clones then checks the bytes that actually landed before
// cloning from them, and deletes the sample either way.
const STALE_SAMPLE_MS = 15 * 60 * 1000;

function extensionFor(contentType: unknown, fileName: unknown): "mp3" | "m4a" | "wav" | null {
  if (typeof contentType === "string" && CLONE_SAMPLE_TYPES[contentType.toLowerCase()]) return CLONE_SAMPLE_TYPES[contentType.toLowerCase()];
  const ext = typeof fileName === "string" ? fileName.split(".").pop()?.toLowerCase() : undefined;
  return ext ? (CLONE_SAMPLE_EXTENSIONS[ext] ?? null) : null;
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  if (!VOICE_CLONING_ENABLED) {
    return NextResponse.json({ error: "Voice cloning is temporarily unavailable. Check back soon." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!(await checkRateLimit(`voice-clone-upload:${user.id}`, 10, 300))) return rateLimitedResponse();

  const body = await request.json().catch(() => null);
  const size = Number(body?.size);
  if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "size is required" }, { status: 400 });
  if (size > CLONE_SAMPLE_MAX_BYTES) return NextResponse.json({ error: "Your sample must be under 20MB." }, { status: 413 });

  const extension = extensionFor(body?.contentType, body?.fileName);
  if (!extension) return NextResponse.json({ error: "Upload a WAV, MP3, MPEG, or M4A file." }, { status: 400 });

  const admin = createAdminClient();
  await ensureBucket(admin, SAMPLE_BUCKET, {
    public: false,
    fileSizeLimit: CLONE_SAMPLE_MAX_BYTES,
    allowedMimeTypes: [...new Set(Object.keys(CLONE_SAMPLE_TYPES))],
  });

  // A sample normally lives only for the length of one clone request, but
  // one abandoned mid-way (picked, then the form closed) would linger --
  // clear the user's stale ones (old enough that no clone can still be
  // reading them) before handing out a new slot.
  const { data: files } = await admin.storage.from(SAMPLE_BUCKET).list(user.id);
  const staleBefore = Date.now() - STALE_SAMPLE_MS;
  const stale = (files ?? []).filter((file) => file.created_at && Date.parse(file.created_at) < staleBefore);
  if (stale.length) {
    await admin.storage.from(SAMPLE_BUCKET).remove(stale.map((file) => `${user.id}/${file.name}`));
  }

  const path = `${user.id}/${randomUUID()}.${extension}`;
  const { data: signed, error } = await admin.storage.from(SAMPLE_BUCKET).createSignedUploadUrl(path);
  if (error || !signed) {
    console.error("[voice-clones/upload] Failed to create signed upload URL:", error);
    return NextResponse.json({ error: "Could not prepare the upload. Please try again." }, { status: 500 });
  }

  // The browser uploads with this exact type, which the bucket allows.
  const contentType = extension === "wav" ? "audio/wav" : extension === "m4a" ? "audio/mp4" : "audio/mpeg";
  return NextResponse.json({ path: signed.path, token: signed.token, contentType });
}

export const POST = withApiLogging("/api/voice-clones/upload", handlePOST);
