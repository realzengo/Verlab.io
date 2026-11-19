import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import type { ClipRenderRequest } from "@/lib/clip-jobs";
import type { ClipMoment } from "@/lib/clips";
import {
  enqueueRenders,
  latestRenderJobs,
  readRenderRequest,
  renderQueueRoom,
  serverRenderEnabledFor,
  toRenderJobs,
  workerOnline,
} from "@/lib/server/clips/jobs";

// Server renders of a project's clips (the render worker, worker/).
//   GET   each clip's latest render, plus whether the server takes renders now
//   POST  { items: ClipRenderRequest[] } -> the queued (or already finished) renders
// A POST the server can't take (switched off, see serverRenderEnabledFor,
// no worker checked in, or its queue full, see renderQueueRoom) answers 503
// { fallback: true }, and the editor renders those clips itself. With room
// for only some, it queues those and the editor renders the rest.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 24;

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
    .maybeSingle<{ id: string; status: string; clips: ClipMoment[] | null }>();
  if (!project) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { user, project };
}

async function serverAvailable(admin: ReturnType<typeof createAdminClient>, email: string | undefined) {
  return serverRenderEnabledFor(email) && (await workerOnline(admin));
}

async function handleGET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error!;

  const admin = createAdminClient();
  try {
    const [rows, available] = await Promise.all([
      latestRenderJobs(admin, { projectId: id, userId: ctx.user.id }),
      serverAvailable(admin, ctx.user.email),
    ]);
    return NextResponse.json(
      { jobs: await toRenderJobs(admin, rows), serverAvailable: available },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return serverError("clips/renders/list", error, "Could not load your renders");
  }
}

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const ctx = await requireProject(id);
  if ("error" in ctx) return ctx.error!;
  if (ctx.project.status !== "ready") return NextResponse.json({ error: "This video isn't ready yet" }, { status: 409 });

  if (!(await checkRateLimit(`clips-render:${ctx.user.id}`, 30, 60))) {
    return rateLimitedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as { items?: ClipRenderRequest[] };
  const requests = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  if (!requests.length) return NextResponse.json({ error: "Nothing to render" }, { status: 400 });

  const items = [];
  for (const item of requests) {
    const read = readRenderRequest(item, { userId: ctx.user.id, projectId: id, clips: ctx.project.clips ?? [] });
    if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 });
    items.push(read);
  }

  const admin = createAdminClient();
  const [available, room] = await Promise.all([serverAvailable(admin, ctx.user.email), renderQueueRoom(admin)]);
  if (!available || room === 0) {
    return NextResponse.json({ error: "Rendering on the server is unavailable", fallback: true }, { status: 503 });
  }

  try {
    const rows = await enqueueRenders(admin, { userId: ctx.user.id, projectId: id, items: items.slice(0, room) });
    return NextResponse.json({ jobs: await toRenderJobs(admin, rows) });
  } catch (error) {
    return serverError("clips/renders/queue", error, "Could not start rendering");
  }
}

export const GET = withApiLogging("/api/clips/[id]/renders", handleGET);
export const POST = withApiLogging("/api/clips/[id]/renders", handlePOST);
