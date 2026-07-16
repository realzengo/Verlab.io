import { NextRequest, NextResponse } from "next/server";
import { getJob, resolveStatus } from "@/lib/server/niche-bend-job-store";
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
