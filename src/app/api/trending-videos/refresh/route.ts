import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchFacelessTrendingVideos } from "@/lib/server/sociavault-client";
import { GLOBAL_REGION } from "@/lib/server/niche-video-refresh";
import { nicheForHashtag } from "@/lib/niches-catalog";
import { batchUpsertTrendingVideos } from "@/lib/server/trending-videos-batch-upsert";

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

    // Follower counts are intentionally left at their scraped value (0 for
    // TikTok's list endpoints) rather than backfilled here -- this cron runs
    // every 30 minutes across the full ~50-hashtag catalog, and backfilling
    // every author on every run was burning 1 SociaVault credit per
    // never-before-seen author, 48 times a day, regardless of whether anyone
    // was even browsing. Real follower counts are now resolved lazily and
    // bounded to whatever page a user actually views -- see
    // backfillPageFollowerCounts in niche-video-query.ts.

    // The trending set changes entirely between refreshes, so replace rather
    // than upsert — otherwise videos that fall out of trending would linger.
    // Scoped to platform='tiktok' so this doesn't wipe out the YouTube pool,
    // which is refreshed independently (and far less often, due to quota) by
    // /api/youtube-videos/refresh.
    const { error: deleteError } = await admin.from("trending_videos").delete().eq("platform", "tiktok");
    if (deleteError) throw new Error(deleteError.message);

    // Chunked + bounded-concurrency rather than one insert() carrying the
    // whole ~50-hashtag catalog (up to a few thousand rows) -- see
    // batchUpsertTrendingVideos for why a single giant write is risky here
    // (one malformed row previously poisoned an entire batch, and a huge
    // payload holds a pooled DB connection longer than it needs to).
    // upsert (not insert) is still safe post-delete: no conflicts are
    // expected, it just tolerates a retry landing rows twice.
    const refreshedAt = new Date().toISOString();
    const summary = await batchUpsertTrendingVideos(
      admin,
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
        refreshed_at: refreshedAt,
      })),
      "trending-videos/refresh"
    );

    if (summary.upsertedRows === 0) throw new Error("Batch upsert failed for every chunk");

    return NextResponse.json({
      ok: true,
      inserted: summary.upsertedRows,
      totalScraped: summary.totalRows,
      failedChunks: summary.failedChunks,
    });
  } catch (error) {
    console.error("[trending-videos/refresh] failed:", error);
    const message = error instanceof Error ? error.message : "Refresh failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
