import type { SupabaseClient } from "@supabase/supabase-js";
import { humanizeViewCount } from "@/lib/server/apify-client";
import { fetchFacelessTrendingVideos, type TrendingTikTokVideo } from "@/lib/server/sociavault-client";
import { fetchTikTokFollowerCounts } from "@/lib/server/tiktok-follower-cache";
import { nicheForHashtag } from "@/lib/niches-catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FacelessChannelVideo } from "@/lib/types";

// Caps how many distinct authors one discovery run ingests -- the hashtag
// sweep this pulls from (fetchFacelessTrendingVideos, ~37 hashtags) can
// surface hundreds of authors; bounding it keeps one run's Supabase writes
// (and the classification pass the caller runs afterward) predictable.
// Re-running picks up whichever authors ranked highest this time. Raised
// from 20 -- with more niche hashtags now in the sweep, 20 was leaving real
// discovered authors on the table every run instead of ingesting them.
const MAX_AUTHORS_PER_RUN = 40;
// Per-author cap on how many of their discovered videos get stored --
// mirrors the "up to 10 recent videos" shape the classifier prompt expects.
const MAX_VIDEOS_PER_AUTHOR = 10;
// "Viral outliers only" -- an author's single best video has to clear this
// real view count before the author is worth a Gemini classification call.
// Applied to bestViewCount (not average), so one breakout video is enough to
// qualify even if the rest of an author's recent videos are unremarkable.
// Lowered from 500k -- 200k catches more real outliers per run without
// meaningfully diluting quality, and a bigger real pool is what actually
// helps the grid's "no videos in this window" fallback trigger less often.
const MIN_VIRAL_VIEW_COUNT = 200_000;

function handleFromVideoUrl(videoUrl: string): string | null {
  // videoUrl is always "https://www.tiktok.com/@<handle>/video/<id>" --
  // built that way in sociavault-client.ts's mapAwemeItems.
  const match = /tiktok\.com\/@([^/]+)\/video\//.exec(videoUrl);
  return match ? match[1] : null;
}

interface DiscoveredAuthor {
  handle: string;
  channelTitle: string;
  avatarUrl: string;
  subscriberCount: number;
  totalViews: number;
  niche: string;
  videos: FacelessChannelVideo[];
  bestViewCount: number;
}

function groupByAuthor(videos: TrendingTikTokVideo[]): DiscoveredAuthor[] {
  // fetchFacelessTrendingVideos sweeps ~28 hashtags independently, so the
  // same video can legitimately appear twice (once per matching hashtag) --
  // dedupe by video id before aggregating per-author totals, otherwise a
  // cross-tagged video would get double-counted into totalViews.
  const seenVideoIds = new Set<string>();
  const authors = new Map<string, DiscoveredAuthor>();

  for (const video of videos) {
    if (seenVideoIds.has(video.id)) continue;
    seenVideoIds.add(video.id);

    const handle = handleFromVideoUrl(video.videoUrl);
    if (!handle) continue;

    let author = authors.get(handle);
    if (!author) {
      author = {
        handle,
        channelTitle: video.author,
        avatarUrl: video.avatarUrl,
        subscriberCount: video.followerCount,
        totalViews: 0,
        niche: nicheForHashtag(video.hashtag),
        videos: [],
        bestViewCount: 0,
      };
      authors.set(handle, author);
    }

    author.totalViews += video.viewCount;
    author.bestViewCount = Math.max(author.bestViewCount, video.viewCount);
    if (author.videos.length < MAX_VIDEOS_PER_AUTHOR) {
      author.videos.push({
        title: video.title,
        viewsCount: video.views,
        likesCount: humanizeViewCount(video.likeCount),
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        coverUrl: video.coverUrl || undefined,
        postedAt: video.postedAt,
        videoUrl: video.videoUrl,
      });
    }
  }

  return [...authors.values()]
    .filter((author) => author.bestViewCount >= MIN_VIRAL_VIEW_COUNT)
    .sort((a, b) => b.bestViewCount - a.bestViewCount)
    .slice(0, MAX_AUTHORS_PER_RUN);
}

export interface DiscoveredChannel {
  channelId: string;
  channelTitle: string;
}

/**
 * Discovers trending TikTok authors via SociaVault's faceless-hashtag search
 * (real handles, avatars, follower counts, and per-video stats -- no guessed
 * URLs) and upserts each into niche_channels, ready for
 * classifyAndStoreChannel(). Ingestion only -- doesn't classify, so the
 * caller can run/report classification as a separate step.
 */
export async function discoverAndIngestTrendingTikTokChannels(
  admin: SupabaseClient = createAdminClient()
): Promise<DiscoveredChannel[]> {
  const videos = await fetchFacelessTrendingVideos();
  const authors = groupByAuthor(videos);
  // groupByAuthor's followerCount comes straight from the hashtag-search
  // response, which TikTok always reports as 0 -- resolve the real number
  // (cached per handle) now that the author list is already deduped and
  // capped to MAX_AUTHORS_PER_RUN, so this only pays for real lookups.
  const followerByHandle = await fetchTikTokFollowerCounts(
    admin,
    authors.map((a) => a.handle)
  );

  const results: DiscoveredChannel[] = [];

  for (const author of authors) {
    const subscriberCount = followerByHandle.get(author.handle) ?? author.subscriberCount;
    const { data, error } = await admin
      .from("niche_channels")
      .upsert(
        {
          platform: "tiktok",
          channel_url: `https://www.tiktok.com/@${author.handle}`,
          channel_title: author.channelTitle,
          avatar_url: author.avatarUrl || null,
          subscriber_count: subscriberCount,
          total_views: author.totalViews,
          recent_videos: author.videos,
          niche: author.niche,
        },
        { onConflict: "channel_url" }
      )
      .select("id, channel_title")
      .single();

    if (error || !data) {
      console.error(`[faceless-tiktok-discovery] Failed to upsert @${author.handle}:`, error);
      continue;
    }

    results.push({ channelId: data.id, channelTitle: data.channel_title });
  }

  return results;
}
