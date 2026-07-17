import { NextRequest, NextResponse } from "next/server";
import { deleteJob, getJob, resolveStatus, setJobSaved } from "@/lib/server/niche-bend-job-store";
import { createClient } from "@/lib/supabase/server";

export async function GET(
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

export async function PATCH(
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

export async function DELETE(
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
