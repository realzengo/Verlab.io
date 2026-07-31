import { NextRequest, NextResponse, after } from "next/server";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { createJob } from "@/lib/server/niche-bend-job-store";
import { getUserCredits } from "@/lib/server/credits";
import { recordUsageEvent } from "@/lib/server/usage";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import type { NicheBendPlatform, NicheBendVideo, NicheBendVideoType } from "@/lib/types";

export const maxDuration = 300;

interface AnalyzeRequestBody {
  url?: string;
  platform?: NicheBendPlatform;
  videoType?: NicheBendVideoType;
  manualVideos?: NicheBendVideo[];
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
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

  // Worst-case pre-check: which branch (manual/cache-hit/scrape) actually
  // runs isn't known until runPipeline executes in the background, so gate
  // on the most expensive one here. This only ever over-protects margin,
  // never under-protects it -- the real, branch-specific charge happens
  // inside runPipeline (see niche-bend-job-store.ts).
  const balance = await getUserCredits(user.id);
  if (balance < TOOL_CREDIT_COSTS.nicheBend.analyzeScrape) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
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

export const POST = withApiLogging("/api/niche-bend/analyze", handlePOST);
