import { NextRequest, NextResponse } from "next/server";
import { getJob, resolveStatus, setChosenBendAndGenerateSop } from "@/lib/server/niche-bend-job-store";

interface SopRequestBody {
  jobId?: string;
  chosenBend?: 1 | 2 | 3;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const currentStatus = resolveStatus(job).status;
  if (currentStatus !== "ready" && currentStatus !== "sop_ready") {
    return NextResponse.json({ error: "Job is not ready yet" }, { status: 409 });
  }

  try {
    await setChosenBendAndGenerateSop(job, chosenBend);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid chosenBend id") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Could not generate the SOP";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json(resolveStatus(job));
}
