import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeVideoOutlierInsights } from "@/lib/server/video-outlier";
import { generateVideoIdeas, VideoIdeasAiError } from "@/lib/server/video-ideas-ai";
import { InsufficientCreditsError, chargeUser, refundUser } from "@/lib/server/credits";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { withApiLogging } from "@/lib/server/api-logging";

export const maxDuration = 60;

function daysSince(iso: string | null): number {
  if (!iso) return 1;
  const posted = new Date(iso).getTime();
  if (Number.isNaN(posted)) return 1;
  return Math.max(1, (Date.now() - posted) / (24 * 60 * 60 * 1000));
}

async function routePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const insights = await computeVideoOutlierInsights(admin, id);
  if (!insights) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  try {
    await chargeUser(user.id, TOOL_CREDIT_COSTS.niches.videoIdeas, "Generate Video Ideas", "niches.video_ideas");
  } catch (creditError) {
    if (creditError instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }
    throw creditError;
  }

  const velocity = insights.video.viewCount / daysSince(insights.video.postedAt);

  try {
    const ideas = await generateVideoIdeas({
      niche: insights.video.nicheCategory,
      title: insights.video.title,
      viewCount: insights.video.viewCount,
      velocity,
      outlierIndex: insights.outlierIndex,
    });

    return NextResponse.json({
      ideas,
      sourceContext: {
        niche: insights.video.nicheCategory,
        title: insights.video.title,
        viewCount: insights.video.viewCount,
        velocity: Math.round(velocity),
        outlierIndex: insights.outlierIndex,
      },
    });
  } catch (error) {
    await refundUser(user.id, TOOL_CREDIT_COSTS.niches.videoIdeas, "Generate Video Ideas refund", "niches.video_ideas");
    if (error instanceof VideoIdeasAiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("[niches/videos/ideas] unhandled error:", error);
    return NextResponse.json({ error: "Something went wrong generating ideas." }, { status: 500 });
  }
}

export const POST = withApiLogging("/api/niches/videos/[id]/ideas", routePOST);
