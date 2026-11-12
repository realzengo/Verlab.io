import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { CLIP_EXPORT_MAX_BYTES, type ClipAspect } from "@/lib/clips";
import {
  CLIP_EXPORTS_BUCKET as BUCKET,
  CLIP_EXPORT_COLUMNS as EXPORT_COLUMNS,
  withClipExportUrls as withUrls,
  type ClipExportRow as ExportRow,
} from "@/lib/server/clips/exports";

// Finished clips, saved to the user's library. The browser renders the MP4,
// then: POST here for a signed upload URL, uploads straight to Storage (the
// file never passes through this server), and PATCH here to record it once
// the upload is really there.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASPECTS: ClipAspect[] = ["9:16", "1:1", "16:9"];

async function requireProject(id: string) {
  if (!UUID.test(id)) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const { data: project } = await supabase
    .from("clip_projects")
    .select("id, status, clips")
    .eq("id", id)
    .maybeSingle<{ id: string; status: string; clips: { id: string }[] | null }>();
  if (!project) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { supabase, user, project };
}

async function handleGET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error!;

  const { data, error } = await ctx.supabase
    .from("clip_exports")
    .select(EXPORT_COLUMNS)
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .returns<ExportRow[]>();
  if (error) return serverError("clips/exports/list", error, "Could not load your clips");
  return NextResponse.json({ exports: await withUrls(data ?? []) });
}

interface ExportBody {
  exportId?: string;
  clipId?: string;
  title?: string;
  aspect?: string;
  durationSeconds?: number;
  sizeBytes?: number;
}

function readBody(body: ExportBody, clipIds: string[]): string | null {
  if (typeof body.clipId !== "string" || !clipIds.includes(body.clipId)) return "Unknown clip";
  if (!ASPECTS.includes(body.aspect as ClipAspect)) return "Unknown aspect ratio";
  if (typeof body.durationSeconds !== "number" || !(body.durationSeconds > 0) || body.durationSeconds > 600) {
    return "Invalid duration";
  }
  return null;
}

/** Step 1: a signed URL to upload one rendered clip to. */
async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error!;

  if (!(await checkRateLimit(`clips-export:${ctx.user.id}`, 30, 60))) {
    return rateLimitedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as ExportBody;
  const problem = readBody(
    body,
    (ctx.project.clips ?? []).map((clip) => clip.id)
  );
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (typeof body.sizeBytes !== "number" || !(body.sizeBytes > 0) || body.sizeBytes > CLIP_EXPORT_MAX_BYTES) {
    return NextResponse.json(
      { error: "This clip is too large to save. Shorten it and export again." },
      { status: 413 }
    );
  }

  const exportId = crypto.randomUUID();
  const path = `${ctx.user.id}/${id}/${exportId}.mp4`;
  const { data: signed, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !signed) return serverError("clips/exports/prepare", error, "Could not save this clip");
  return NextResponse.json({ exportId, path: signed.path, token: signed.token });
}

/** Step 2: records an upload the browser finished, after checking it's really there. */
async function handlePATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error!;

  const body = (await request.json().catch(() => ({}))) as ExportBody;
  const problem = readBody(
    body,
    (ctx.project.clips ?? []).map((clip) => clip.id)
  );
  if (problem || typeof body.exportId !== "string" || !UUID.test(body.exportId)) {
    return NextResponse.json({ error: problem ?? "Invalid export" }, { status: 400 });
  }

  const admin = createAdminClient();
  const folder = `${ctx.user.id}/${id}`;
  const fileName = `${body.exportId}.mp4`;
  const { data: listed } = await admin.storage.from(BUCKET).list(folder, { search: fileName });
  const object = listed?.find((entry) => entry.name === fileName);
  const size = Number((object?.metadata as { size?: number } | undefined)?.size ?? 0);
  if (!object || !(size > 0)) {
    return NextResponse.json({ error: "The upload didn't arrive. Try again." }, { status: 409 });
  }

  const title = (typeof body.title === "string" ? body.title : "").replace(/\s+/g, " ").trim().slice(0, 120) || "Clip";
  const { data: row, error } = await admin
    .from("clip_exports")
    .insert({
      id: body.exportId,
      user_id: ctx.user.id,
      project_id: id,
      clip_id: body.clipId,
      title,
      storage_path: `${folder}/${fileName}`,
      aspect: body.aspect,
      duration_seconds: Math.round(body.durationSeconds! * 100) / 100,
      size_bytes: size,
    })
    .select(EXPORT_COLUMNS)
    .single<ExportRow>();
  if (error || !row) {
    await admin.storage.from(BUCKET).remove([`${folder}/${fileName}`]);
    return serverError("clips/exports/confirm", error, "Could not save this clip");
  }

  const [saved] = await withUrls([row]);
  return NextResponse.json({ export: saved ?? null });
}

async function handleDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error!;

  const exportId = request.nextUrl.searchParams.get("exportId") ?? "";
  if (!UUID.test(exportId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: row } = await ctx.supabase
    .from("clip_exports")
    .delete()
    .eq("id", exportId)
    .eq("project_id", id)
    .select("storage_path")
    .maybeSingle<{ storage_path: string }>();
  if (row) await createAdminClient().storage.from(BUCKET).remove([row.storage_path]);
  return NextResponse.json({ ok: true });
}

export const GET = withApiLogging("/api/clips/[id]/exports", handleGET);
export const POST = withApiLogging("/api/clips/[id]/exports", handlePOST);
export const PATCH = withApiLogging("/api/clips/[id]/exports", handlePATCH);
export const DELETE = withApiLogging("/api/clips/[id]/exports", handleDELETE);
