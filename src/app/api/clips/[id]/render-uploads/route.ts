import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { renderInputPath } from "@/lib/clip-jobs";
import { CLIP_EXPORT_MAX_BYTES } from "@/lib/clips";
import { CLIP_EXPORTS_BUCKET as BUCKET } from "@/lib/server/clips/exports";

// Where the editor uploads a server render's inputs: a clip's face track and
// the split layout's bottom video. Files are named by their content's hash,
// so an input already uploaded (the same track, the same bottom video for
// every clip) isn't sent again: those come back with `exists: true`.
//   POST { files: [{ kind: "track", clipId, hash, sizeBytes } | { kind: "background", hash, sizeBytes }] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const CLIP_ID = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_TRACK_BYTES = 20 * 1024 * 1024;

interface UploadRequest {
  kind?: "track" | "background";
  clipId?: string;
  hash?: string;
  sizeBytes?: number;
}

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: project } = await supabase
    .from("clip_projects")
    .select("id")
    .eq("id", id)
    .maybeSingle<{ id: string }>();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await checkRateLimit(`clips-render-upload:${user.id}`, 60, 60))) {
    return rateLimitedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as { files?: UploadRequest[] };
  const files = Array.isArray(body.files) ? body.files.slice(0, 24) : [];
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

  const paths: string[] = [];
  for (const file of files) {
    const size = Number(file.sizeBytes);
    if (typeof file.hash !== "string" || !HASH.test(file.hash) || !(size > 0)) {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }
    const hash = file.hash.slice(0, 32);
    if (file.kind === "track" && typeof file.clipId === "string" && CLIP_ID.test(file.clipId)) {
      if (size > MAX_TRACK_BYTES) return NextResponse.json({ error: "Face track too large" }, { status: 413 });
      paths.push(renderInputPath.track(user.id, id, file.clipId, hash));
    } else if (file.kind === "background") {
      if (size > CLIP_EXPORT_MAX_BYTES) {
        return NextResponse.json({ error: "That video is too large for split screen" }, { status: 413 });
      }
      paths.push(renderInputPath.background(user.id, id, hash));
    } else {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }
  }

  const storage = createAdminClient().storage.from(BUCKET);
  try {
    const { data: listed } = await storage.list(`${user.id}/${id}/inputs`, { limit: 1000 });
    const present = new Set((listed ?? []).map((entry) => `${user.id}/${id}/inputs/${entry.name}`));
    const uploads = await Promise.all(
      paths.map(async (path) => {
        if (present.has(path)) return { path, exists: true as const };
        const { data, error } = await storage.createSignedUploadUrl(path, { upsert: true });
        if (error || !data) throw error ?? new Error("No upload URL");
        return { path, exists: false as const, token: data.token };
      })
    );
    return NextResponse.json({ uploads });
  } catch (error) {
    return serverError("clips/render-uploads", error, "Could not prepare the render");
  }
}

export const POST = withApiLogging("/api/clips/[id]/render-uploads", handlePOST);
