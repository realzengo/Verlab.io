import { NextRequest, NextResponse, after } from "next/server";
import { createJob } from "@/lib/server/niche-bend-job-store";
import { recordUsageEvent } from "@/lib/server/usage";
import { createClient } from "@/lib/supabase/server";
import type { NicheBendPlatform, NicheBendVideo, NicheBendVideoType } from "@/lib/types";

interface AnalyzeRequestBody {
  url?: string;
  platform?: NicheBendPlatform;
  videoType?: NicheBendVideoType;
  manualVideos?: NicheBendVideo[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

  const job = await createJob(supabase, user.id, {
    sourceUrl: url ?? "",
    platform,
    videoType: videoType === "shorts" || videoType === "long-form" ? videoType : "long-form",
    manualVideos: hasManualVideos ? manualVideos : undefined,
  });

  after(() => recordUsageEvent("bend", user.id, { jobId: job.id }));

  return NextResponse.json({ jobId: job.id });
}
