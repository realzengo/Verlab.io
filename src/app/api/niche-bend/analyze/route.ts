import { NextRequest, NextResponse, after } from "next/server";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { createJob } from "@/lib/server/niche-bend-job-store";
import { getUserCredits } from "@/lib/server/credits";
import { recordUsageEvent } from "@/lib/server/usage";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { isValidUrl } from "@/lib/validation";
import type { NicheBendPlatform, NicheBendVideo, NicheBendVideoType } from "@/lib/types";

export const maxDuration = 300;

// Mirrors parseManualVideos' own 10-video client-side cap (manual-parse.ts)
// with generous headroom for a raw API call that bypasses that client
// logic entirely -- guards against an oversized manualVideos payload being
// fed straight into the pipeline.
const MAX_MANUAL_VIDEOS = 200;
const MAX_MANUAL_VIDEOS_TOTAL_TITLE_CHARS = 20000;

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

  if (!hasManualVideos && url && !isValidUrl(url)) {
    return NextResponse.json({ error: "url must be a valid http(s) URL" }, { status: 400 });
  }

  if (hasManualVideos && manualVideos!.length < 3) {
    return NextResponse.json({ error: "Provide at least 3 manually pasted videos" }, { status: 400 });
  }

  if (hasManualVideos && manualVideos!.length > MAX_MANUAL_VIDEOS) {
    return NextResponse.json({ error: `Provide at most ${MAX_MANUAL_VIDEOS} manually pasted videos` }, { status: 400 });
  }

  if (hasManualVideos) {
    const totalTitleChars = manualVideos!.reduce(
      (sum, v) => sum + (typeof v?.title === "string" ? v.title.length : 0),
      0
    );
    if (totalTitleChars > MAX_MANUAL_VIDEOS_TOTAL_TITLE_CHARS) {
      return NextResponse.json({ error: "Manually pasted videos are too long in total" }, { status: 400 });
    }
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
