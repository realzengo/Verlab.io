import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClippingCost } from "@/lib/config/pricing";
import { InsufficientCreditsError, chargeUser, refundUser } from "@/lib/server/credits";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { checkRateLimit, rateLimitedResponse } from "@/lib/server/rate-limit";
import { getClipSourceVideo } from "@/lib/server/clips/youtube";
import { YoutubeError } from "@/lib/server/youtube-client";
import {
  CLIP_PROJECT_COLUMNS,
  prepareClipProject,
  toClipProject,
  type ClipProjectRow,
} from "@/lib/server/clips/projects";
import { clipSourceProblem } from "@/lib/server/clips/source-rules";
import { normalizeClipOptions, parseYoutubeVideoId, youtubeWatchUrl } from "@/lib/clips";

// Fetching the audio and starting WhisperX runs in after(), which shares
// this budget; the provider job alone can take a couple of minutes.
export const maxDuration = 300;

const LIST_LIMIT = 24;

async function handleGET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("clip_projects")
    .select(CLIP_PROJECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT)
    .returns<ClipProjectRow[]>();

  if (error) {
    return serverError("clips/list", error, "Could not load your clip projects");
  }
  return NextResponse.json({ projects: (data ?? []).map(toClipProject) });
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`clips-create:${user.id}`, 5, 60))) {
    return rateLimitedResponse();
  }

  let body: { url?: string; options?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const videoId = parseYoutubeVideoId(body.url ?? "");
  if (!videoId) {
    return NextResponse.json({ error: "Paste a YouTube video link" }, { status: 400 });
  }

  let video;
  try {
    video = await getClipSourceVideo(videoId);
  } catch (error) {
    if (error instanceof YoutubeError && error.code === "quota_exceeded") {
      return NextResponse.json({ error: "YouTube is busy right now. Try again in a little while." }, { status: 503 });
    }
    return serverError("clips/create", error, "Could not look up that video");
  }
  if (!video) {
    return NextResponse.json({ error: "That video couldn't be found. It may be private or deleted." }, { status: 404 });
  }

  const problem = clipSourceProblem(video.durationSeconds);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const cost = getClippingCost(video.durationSeconds);
  try {
    await chargeUser(user.id, cost, "Clipping", "clipping.analyze");
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits", credits: cost }, { status: 402 });
    }
    throw error;
  }

  // Service role: users can read and delete their projects, never write them.
  const { data, error } = await createAdminClient()
    .from("clip_projects")
    .insert({
      user_id: user.id,
      source_url: youtubeWatchUrl(videoId),
      video_id: videoId,
      title: video.title,
      channel_title: video.channelTitle || null,
      thumbnail_url: video.thumbnailUrl || null,
      duration_seconds: video.durationSeconds,
      options: normalizeClipOptions(body.options),
      credits_charged: cost,
    })
    .select(CLIP_PROJECT_COLUMNS)
    .single<ClipProjectRow>();

  if (error || !data) {
    await refundUser(user.id, cost, "Clipping refund", "clipping.analyze");
    return serverError("clips/create", error, "Could not start clipping");
  }

  // Replicate calls back when the transcript is done, so the project finishes
  // with no one on the page. It can't reach a local http dev server.
  const webhookUrl = request.nextUrl.protocol === "https:" ? `${request.nextUrl.origin}/api/webhooks/replicate` : undefined;
  after(() => prepareClipProject(data.id, webhookUrl));

  return NextResponse.json({ project: toClipProject(data) });
}

export const GET = withApiLogging("/api/clips", handleGET);
export const POST = withApiLogging("/api/clips", handlePOST);
