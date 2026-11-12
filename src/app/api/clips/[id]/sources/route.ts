import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import {
  CLIP_SOURCES_BUCKET,
  PRECUT_MAX_MS,
  clipSourcePath,
  type StoredClipMoment,
} from "@/lib/server/clips/precut";
import type { ClipStoredSource } from "@/lib/clips";

// The clips the server has already cut for this project (see precut.ts):
// signed URLs for the stored ones, how far the read has got for the ones
// still on their way. The editor cuts anything else itself through
// POST /api/clips/[id]/segments.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_SECONDS = 60 * 60;

async function handleGET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: row } = await supabase
    .from("clip_projects")
    .select("id, user_id, status, clips")
    .eq("id", id)
    .maybeSingle<{ id: string; user_id: string; status: string; clips: StoredClipMoment[] | null }>();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sources: Record<string, ClipStoredSource> = {};
  const paths: string[] = [];
  for (const clip of row.status === "ready" ? (row.clips ?? []) : []) {
    const cut = clip.cut;
    if (cut?.state === "stored") {
      for (let part = 0; part < cut.parts; part++) paths.push(clipSourcePath(row, clip.id, part));
    } else if (cut?.state === "cutting" && Date.now() - Date.parse(cut.startedAt) < PRECUT_MAX_MS) {
      sources[clip.id] = { state: "cutting", reached: cut.reached };
    } else {
      // Never cut, failed, or a pre-cut that died with its function.
      sources[clip.id] = { state: "none" };
    }
  }

  if (paths.length) {
    const { data, error } = await createAdminClient()
      .storage.from(CLIP_SOURCES_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) return serverError("clips/sources", error, "Could not load your clips");
    const urls = new Map((data ?? []).map((entry) => [entry.path, entry.signedUrl]));
    for (const clip of row.clips ?? []) {
      const cut = clip.cut;
      if (cut?.state !== "stored") continue;
      const parts = Array.from({ length: cut.parts }, (_, part) => urls.get(clipSourcePath(row, clip.id, part)));
      // A missing part (cleaned up since) means cutting it again.
      sources[clip.id] = parts.every(Boolean)
        ? { state: "stored", from: cut.from, to: cut.to, offset: cut.offset, urls: parts as string[] }
        : { state: "none" };
    }
  }

  return NextResponse.json({ sources }, { headers: { "Cache-Control": "private, no-store" } });
}

export const GET = withApiLogging("/api/clips/[id]/sources", handleGET);
