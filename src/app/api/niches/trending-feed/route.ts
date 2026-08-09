import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { humanizeViewCount } from "@/lib/server/apify-client";
import { fetchTikTokTrendingFeed, SociaVaultError } from "@/lib/server/sociavault-client";
import { nicheForHashtag } from "@/lib/niches-catalog";
import type { TrendingFeedVideo } from "@/lib/types";

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "US";

  let items;
  try {
    items = await fetchTikTokTrendingFeed(region);
  } catch (error) {
    if (error instanceof SociaVaultError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "not_configured" ? 501 : 502 });
    }
    throw error;
  }

  const videos: TrendingFeedVideo[] = items.map((item) => ({
    id: item.id,
    platform: "tiktok",
    category: item.hashtag ? nicheForHashtag(item.hashtag) : "Trending",
    thumbnailUrl: item.coverUrl,
    videoUrl: item.videoUrl,
    viewsCount: item.views,
    likesCount: humanizeViewCount(item.likeCount),
    viewCount: item.viewCount,
    followerCount: item.followerCount,
    postedAt: item.postedAt,
  }));

  return NextResponse.json(
    { videos },
    {
      headers: {
        // Matches the fetchTikTokTrendingFeed cache window -- no point
        // serving a shorter-lived response than the data underneath it.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}

export const GET = withApiLogging("/api/niches/trending-feed", handleGET);
