import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchFacelessTrendingVideos } from "@/lib/server/sociavault-client";
import { GLOBAL_REGION } from "@/lib/server/niche-video-refresh";
import { nicheForHashtag } from "@/lib/niches-catalog";
import { batchUpsertTrendingVideos } from "@/lib/server/trending-videos-batch-upsert";
import { removeCoversOfPrunedVideos } from "@/lib/server/tiktok-covers";

export const maxDuration = 300;

const TIKTOK_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
// Most of this route's 300s goes to the scrape itself; this leaves room to
// copy a full catalog's worth of new covers on top. Anything past it is left
// for /api/cron/tiktok-covers.
const COVER_COPY_BUDGET_MS = 120_000;

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

    // Chunked + bounded-concurrency rather than one insert() carrying the
    // whole ~50-hashtag catalog (up to a few thousand rows) -- see
    // batchUpsertTrendingVideos for why a single giant write is risky here
    // (one malformed row previously poisoned an entire batch, and a huge
    // payload holds a pooled DB connection longer than it needs to).
    // Upserting (onConflict: "id") rather than deleting-then-inserting is
    // deliberate: a video that's still trending keeps the same id, so the
    // upsert leaves its transcript_analysis (written by the enrichment cron,
    // see niche-video-enrichment.ts) and everything else not in this payload
    // untouched. Deleting the whole platform first used to wipe that column
    // back to NULL every 30 minutes even for videos that never stopped
    // trending, which is why per-video faceless coverage stayed near zero
    // despite the enrichment worker running steadily.
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
      "trending-videos/refresh",
      { coverCopyBudgetMs: COVER_COPY_BUDGET_MS }
    );

    if (summary.upsertedRows === 0) throw new Error("Batch upsert failed for every chunk");

    // Prune TikTok rows that no scrape has touched in a week -- this run's
    // upsert re-stamps every video still trending, and on-demand niche warms
    // and searches stamp their own rows too. Pruning by age (rather than
    // "anything not in this exact run") means a partial or failed scrape
    // can't wipe the pool down to a sliver, and the niche warms that fill
    // the long tail survive between refreshes. Scoped to platform='tiktok';
    // the YouTube pool is refreshed independently by /api/youtube-videos/refresh.
    const staleBefore = new Date(Date.now() - TIKTOK_STALE_AFTER_MS).toISOString();
    const { data: pruned, error: deleteStaleError } = await admin
      .from("trending_videos")
      .delete()
      .eq("platform", "tiktok")
      .lt("refreshed_at", staleBefore)
      .select("id");
    if (deleteStaleError) throw new Error(deleteStaleError.message);
    await removeCoversOfPrunedVideos(admin, (pruned ?? []).map((row) => row.id));

    return NextResponse.json({
      ok: true,
      inserted: summary.upsertedRows,
      totalScraped: summary.totalRows,
      failedChunks: summary.failedChunks,
      covers: summary.covers,
      pruned: pruned?.length ?? 0,
    });
  } catch (error) {
    console.error("[trending-videos/refresh] failed:", error);
    const message = error instanceof Error ? error.message : "Refresh failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// Vercel Cron invokes scheduled routes with GET (see vercel.json); POST stays
// for manual runs with `Authorization: Bearer $CRON_SECRET`. This route used
// to export POST only, so every scheduled run was rejected with a 405.
export const GET = POST;
