import { NextRequest, NextResponse } from "next/server";
import { getJob, resolveStatus } from "@/lib/server/niche-bend-job-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(resolveStatus(job));
}
