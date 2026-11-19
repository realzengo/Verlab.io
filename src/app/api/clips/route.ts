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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ?all=1, for the "Your clips" page.
const LIST_ALL_LIMIT = 100;

async function handleGET(request: NextRequest): Promise<NextResponse> {
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
    .limit(request.nextUrl.searchParams.get("all") === "1" ? LIST_ALL_LIMIT : LIST_LIMIT)
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

  let body: { url?: string; options?: unknown; requestId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // One id per Create the user means: a repeat of it (a double click, a
  // retry after a dropped answer, a second tab) gets the project it already
  // made, and is never charged again.
  const requestId =
    typeof body.requestId === "string" && UUID.test(body.requestId) ? body.requestId : crypto.randomUUID();
  const admin = createAdminClient();
  const repeat = await projectForRequest(admin, user.id, requestId);
  if (repeat) return NextResponse.json({ project: toClipProject(repeat) });

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

  // Recorded before charging, so two copies of one request can't both charge:
  // the second's insert collides on (user_id, request_id) and returns the
  // first's project. Service role: users can read and delete their projects,
  // never write them.
  const { data: created, error } = await admin
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
      credits_charged: 0,
      request_id: requestId,
    })
    .select(CLIP_PROJECT_COLUMNS)
    .single<ClipProjectRow>();
  if (error?.code === "23505") {
    const first = await projectForRequest(admin, user.id, requestId);
    if (first) return NextResponse.json({ project: toClipProject(first) });
  }
  if (error || !created) return serverError("clips/create", error, "Could not start clipping");

  try {
    await chargeUser(user.id, cost, "Clipping", "clipping.analyze");
  } catch (chargeError) {
    await admin.from("clip_projects").delete().eq("id", created.id);
    if (chargeError instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits", credits: cost }, { status: 402 });
    }
    throw chargeError;
  }
  const { data, error: chargedError } = await admin
    .from("clip_projects")
    .update({ credits_charged: cost })
    .eq("id", created.id)
    .select(CLIP_PROJECT_COLUMNS)
    .single<ClipProjectRow>();
  if (chargedError || !data) {
    // Charged but not recorded: give the credits back rather than keep them for nothing.
    await refundUser(user.id, cost, "Clipping refund", "clipping.analyze");
    await admin.from("clip_projects").delete().eq("id", created.id);
    return serverError("clips/create", chargedError, "Could not start clipping");
  }

  // Replicate calls back when the transcript is done, so the project finishes
  // with no one on the page. It can't reach a local http dev server.
  const webhookUrl = request.nextUrl.protocol === "https:" ? `${request.nextUrl.origin}/api/webhooks/replicate` : undefined;
  after(() => prepareClipProject(data.id, webhookUrl));

  return NextResponse.json({ project: toClipProject(data) });
}

/** The project an earlier copy of this Create request made, if any. */
async function projectForRequest(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  requestId: string
): Promise<ClipProjectRow | null> {
  const { data } = await admin
    .from("clip_projects")
    .select(CLIP_PROJECT_COLUMNS)
    .eq("user_id", userId)
    .eq("request_id", requestId)
    .maybeSingle<ClipProjectRow>();
  return data ?? null;
}

export const GET = withApiLogging("/api/clips", handleGET);
export const POST = withApiLogging("/api/clips", handlePOST);
