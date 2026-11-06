import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClippingCost } from "@/lib/config/pricing";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { YoutubeError } from "@/lib/server/youtube-client";
import { getClipSourceVideo } from "@/lib/server/clips/youtube";
import { clipSourceProblem } from "@/lib/server/clips/source-rules";
import { parseYoutubeVideoId } from "@/lib/clips";

// What a pasted link would cost before anything is charged: title, length,
// credits, or why it can't be clipped. One cached videos.list unit.
async function handleGET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const videoId = parseYoutubeVideoId(request.nextUrl.searchParams.get("url") ?? "");
  if (!videoId) {
    return NextResponse.json({ error: "Paste a YouTube video link" }, { status: 400 });
  }

  try {
    const video = await getClipSourceVideo(videoId);
    if (!video) {
      return NextResponse.json(
        { error: "That video couldn't be found. It may be private or deleted." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      video,
      credits: getClippingCost(Math.max(1, video.durationSeconds)),
      problem: clipSourceProblem(video.durationSeconds),
    });
  } catch (error) {
    if (error instanceof YoutubeError && error.code === "quota_exceeded") {
      return NextResponse.json({ error: "YouTube is busy right now. Try again in a little while." }, { status: 503 });
    }
    return serverError("clips/preview", error, "Couldn't look up that video");
  }
}

export const GET = withApiLogging("/api/clips/preview", handleGET);
