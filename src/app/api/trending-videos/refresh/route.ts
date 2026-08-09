import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchFacelessTrendingVideos } from "@/lib/server/sociavault-client";
import { backfillTikTokVideoFollowerCounts } from "@/lib/server/tiktok-follower-cache";
import { GLOBAL_REGION } from "@/lib/server/niche-video-refresh";
import { nicheForHashtag } from "@/lib/niches-catalog";

function isAuthorized(request: NextRequest): boolean {
  // Vercel Cron requests carry this header automatically when deployed there;
  // fall back to a bearer token so the route can also be triggered manually
  // (local testing, a different scheduler) via `Authorization: Bearer $CRON_SECRET`.
  if (request.headers.get("x-vercel-cron")) return true;

  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    const videos = await fetchFacelessTrendingVideos();

    if (videos.length === 0) {
      throw new Error("No trending videos returned");
    }

    await backfillTikTokVideoFollowerCounts(admin, videos);

    // The trending set changes entirely between refreshes, so replace rather
    // than upsert — otherwise videos that fall out of trending would linger.
    // Scoped to platform='tiktok' so this doesn't wipe out the YouTube pool,
    // which is refreshed independently (and far less often, due to quota) by
    // /api/youtube-videos/refresh.
    const { error: deleteError } = await admin.from("trending_videos").delete().eq("platform", "tiktok");
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await admin.from("trending_videos").insert(
      videos.map((v) => ({
        id: v.id,
        title: v.title,
        views: v.views,
        view_count: v.viewCount,
        like_count: v.likeCount,
        comment_count: v.commentCount,
        share_count: v.shareCount,
        follower_count: v.followerCount,
        cover_url: v.coverUrl,
        video_url: v.videoUrl,
        author: v.author,
        avatar_url: v.avatarUrl,
        hashtag: v.hashtag,
        niche_category: nicheForHashtag(v.hashtag),
        platform: "tiktok",
        region: GLOBAL_REGION,
        posted_at: v.postedAt,
        refreshed_at: new Date().toISOString(),
      }))
    );

    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({ ok: true, inserted: videos.length });
  } catch (error) {
    console.error("[trending-videos/refresh] failed:", error);
    const message = error instanceof Error ? error.message : "Refresh failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
