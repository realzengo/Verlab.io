import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import {
  CLIP_PROJECT_COLUMNS,
  advanceClipProject,
  toClipProject,
  type ClipProjectRow,
} from "@/lib/server/clips/projects";
import { isClipProjectWorking } from "@/lib/clips";

// The poll that finds the transcript done runs the moment-finding LLM pass
// inline: ~70s for an hour of transcript, longer for 3 hours or a fallback.
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    .select(CLIP_PROJECT_COLUMNS)
    .eq("id", id)
    .maybeSingle<ClipProjectRow>();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let current = row;
  if (isClipProjectWorking(row.status)) {
    try {
      current = await advanceClipProject(row);
    } catch (error) {
      // A failed status check (Replicate blip) just means "still working";
      // the next poll tries again.
      console.error("[clips] advance failed:", error);
    }
  }

  // Captions need the words; only sent once there's something to caption.
  if (current.status === "ready") {
    const { data: words } = await supabase
      .from("clip_projects")
      .select("transcript")
      .eq("id", id)
      .maybeSingle<{ transcript: ClipProjectRow["transcript"] }>();
    current = { ...current, transcript: words?.transcript ?? null };
  }

  return NextResponse.json({ project: toClipProject(current) });
}

async function handleDELETE(
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

  const { data: deleted, error } = await supabase.from("clip_projects").delete().eq("id", id).select("id");
  if (error) {
    return serverError("clips/delete", error, "Could not delete that project");
  }

  // The rows of its saved clips went with the cascade; their files didn't.
  if (deleted?.length) {
    const admin = createAdminClient();
    const folder = `${user.id}/${id}`;
    const { data: files } = await admin.storage.from("clip-exports").list(folder);
    if (files?.length) {
      await admin.storage.from("clip-exports").remove(files.map((file) => `${folder}/${file.name}`));
    }
  }
  return NextResponse.json({ ok: true });
}

export const GET = withApiLogging("/api/clips/[id]", handleGET);
export const DELETE = withApiLogging("/api/clips/[id]", handleDELETE);
