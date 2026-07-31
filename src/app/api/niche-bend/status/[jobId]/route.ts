import { NextRequest, NextResponse } from "next/server";
import { deleteJob, getJob, resolveStatus, setJobSaved } from "@/lib/server/niche-bend-job-store";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const { jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RLS already scopes this select to the caller's own jobs — a job that
  // belongs to someone else simply comes back null, same as "not found".
  const job = await getJob(supabase, jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(resolveStatus(job));
}

async function handlePATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const { jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { saved?: unknown } | null;
  if (!body || typeof body.saved !== "boolean") {
    return NextResponse.json({ error: "`saved` must be a boolean" }, { status: 400 });
  }

  const job = await getJob(supabase, jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await setJobSaved(supabase, jobId, body.saved);

  return NextResponse.json(resolveStatus({ ...job, saved: body.saved }));
}

async function handleDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const { jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await deleteJob(supabase, jobId);

  return NextResponse.json({ ok: true });
}

export const GET = withApiLogging("/api/niche-bend/status/[jobId]", handleGET);
export const PATCH = withApiLogging("/api/niche-bend/status/[jobId]", handlePATCH);
export const DELETE = withApiLogging("/api/niche-bend/status/[jobId]", handleDELETE);
