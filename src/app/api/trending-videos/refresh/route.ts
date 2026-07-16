import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchFacelessTrendingVideos } from "@/lib/server/apify-client";

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
    const videos = await fetchFacelessTrendingVideos(200);

    if (videos.length === 0) {
      throw new Error("No trending videos returned");
    }

    // The trending set changes entirely between refreshes, so replace rather
    // than upsert — otherwise videos that fall out of trending would linger.
    const { error: deleteError } = await admin.from("trending_videos").delete().neq("id", "");
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
        region: "global",
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
