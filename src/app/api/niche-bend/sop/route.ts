import { NextRequest, NextResponse } from "next/server";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { getJob, resolveStatus, startSopGeneration } from "@/lib/server/niche-bend-job-store";
import { getUserCredits } from "@/lib/server/credits";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

interface SopRequestBody {
  jobId?: string;
  chosenBend?: 1 | 2 | 3;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: SopRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobId, chosenBend } = body;

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  if (chosenBend !== 1 && chosenBend !== 2 && chosenBend !== 3) {
    return NextResponse.json({ error: "chosenBend must be 1, 2, or 3" }, { status: 400 });
  }

  const job = await getJob(supabase, jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const currentStatus = resolveStatus(job).status;
  if (currentStatus !== "ready" && currentStatus !== "sop_ready") {
    return NextResponse.json({ error: "Job is not ready yet" }, { status: 409 });
  }

  const balance = await getUserCredits(user.id);
  if (balance < TOOL_CREDIT_COSTS.nicheBend.sop) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  let updatedJob;
  try {
    updatedJob = await startSopGeneration(supabase, job, chosenBend);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid chosenBend id") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Could not generate the SOP";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Returns as soon as generation has been kicked off (status "generating_sop"),
  // not once it's finished — the actual writing continues in the background
  // (see startSopGeneration) and the client polls /status/[jobId] for "sop_ready".
  return NextResponse.json(resolveStatus(updatedJob));
}
