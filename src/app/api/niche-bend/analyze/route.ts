import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/lib/server/niche-bend-job-store";
import type { NicheBendPlatform, NicheBendVideo, NicheBendVideoType } from "@/lib/types";

interface AnalyzeRequestBody {
  url?: string;
  platform?: NicheBendPlatform;
  videoType?: NicheBendVideoType;
  manualVideos?: NicheBendVideo[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: AnalyzeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, platform, videoType, manualVideos } = body;

  if (platform !== "youtube" && platform !== "tiktok") {
    return NextResponse.json({ error: "platform must be 'youtube' or 'tiktok'" }, { status: 400 });
  }

  const hasManualVideos = Array.isArray(manualVideos) && manualVideos.length > 0;

  if (!hasManualVideos && (!url || !url.trim())) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  if (hasManualVideos && manualVideos!.length < 3) {
    return NextResponse.json({ error: "Provide at least 3 manually pasted videos" }, { status: 400 });
  }

  const job = createJob({
    sourceUrl: url ?? "",
    platform,
    videoType: videoType === "shorts" || videoType === "long-form" ? videoType : "long-form",
    manualVideos: hasManualVideos ? manualVideos : undefined,
  });

  return NextResponse.json({ jobId: job.id });
}
