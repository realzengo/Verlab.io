import { NextRequest, NextResponse } from "next/server";
import { getJob, regenerateOneCandidateInJob, resolveStatus } from "@/lib/server/niche-bend-job-store";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

interface RegenerateCandidateRequestBody {
  jobId?: string;
  candidateId?: 1 | 2 | 3;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: RegenerateCandidateRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobId, candidateId } = body;

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  if (candidateId !== 1 && candidateId !== 2 && candidateId !== 3) {
    return NextResponse.json({ error: "candidateId must be 1, 2, or 3" }, { status: 400 });
  }

  const job = await getJob(supabase, jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const currentStatus = resolveStatus(job).status;
  if (currentStatus !== "ready" && currentStatus !== "sop_ready") {
    return NextResponse.json({ error: "Job is not ready yet" }, { status: 409 });
  }

  try {
    await regenerateOneCandidateInJob(supabase, job, candidateId);
  } catch (error) {
    if (error instanceof Error && (error.message === "Invalid candidateId" || error.message === "Job is not ready yet")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Could not regenerate this idea";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const updatedJob = await getJob(supabase, jobId);
  return NextResponse.json(resolveStatus(updatedJob!));
}
