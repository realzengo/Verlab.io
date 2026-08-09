import type { SupabaseClient } from "@supabase/supabase-js";
import { humanizeViewCount } from "@/lib/server/apify-client";
import { fetchNicheYoutubeVideos, type TrendingYoutubeVideo } from "@/lib/server/youtube-client";
import { NICHE_HASHTAGS } from "@/lib/niches-catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FacelessChannelVideo } from "@/lib/types";

// YouTube's search.list costs 100 quota units per keyword against a default
// 10,000/day budget (see the comment in api/youtube-videos/refresh/route.ts)
// -- unlike TikTok/SociaVault's cheap credit-per-page model, this can't sweep
// dozens of hashtags in one run. Expanded on 2026-08-09 to cover all 16
// target faceless niches (18 keywords = 1,800 quota units/run) -- each
// query below was individually verified against the real search.list
// endpoint (real results within the 45-day discovery window) before being
// added, same as the SociaVault/TikTok hashtag list. These are free-text
// search queries, not hashtags -- YouTube's search doesn't have a dedicated
// hashtag-search mode the way TikTok/SociaVault do, so the phrasing here
// deliberately differs from NICHE_HASHTAGS's single-word tags for the niches
// that already had a TikTok hashtag entry.
const DISCOVERY_KEYWORDS = [
  ...NICHE_HASHTAGS.History, // History
  ...NICHE_HASHTAGS.Horror, // Horror
  ...NICHE_HASHTAGS.Storytelling.slice(0, 1), // Stories
  "sports facts", // Sports
  "animated story", // Animation
  "motivational story", // Motivational
  "car facts", // Cars
  "quiz trivia", // Quizzes & Trivia
  "brainrot", // Brainrot
  "geography facts", // Geography
  "ai generated story", // AI
  "movie recap", // Media
  "gaming facts", // Gaming
  "animal facts", // Animals
  "celebrity facts", // Celebrity
  "bodycam footage", // Bodycam
];

// Raised from 15 alongside the keyword expansion above (5 -> 18 keywords) --
// 15 was tuned for a 5-keyword sweep and would truncate real per-niche
// diversity now that ~3x as many niches are represented.
const MAX_AUTHORS_PER_RUN = 32;
const MAX_VIDEOS_PER_AUTHOR = 10;
const TARGET_VIDEO_COUNT = 100;

interface DiscoveredAuthor {
  channelId: string;
  channelTitle: string;
  avatarUrl: string;
  subscriberCount: number;
  totalViews: number;
  niche: string;
  videos: FacelessChannelVideo[];
  bestViewCount: number;
}

function groupByChannel(videos: TrendingYoutubeVideo[]): DiscoveredAuthor[] {
  const seenVideoIds = new Set<string>();
  const channels = new Map<string, DiscoveredAuthor>();

  for (const video of videos) {
    if (seenVideoIds.has(video.id)) continue;
    seenVideoIds.add(video.id);

    let channel = channels.get(video.channelId);
    if (!channel) {
      channel = {
        channelId: video.channelId,
        channelTitle: video.author,
        avatarUrl: video.avatarUrl,
        subscriberCount: video.followerCount,
        totalViews: 0,
        niche: video.hashtag,
        videos: [],
        bestViewCount: 0,
      };
      channels.set(video.channelId, channel);
    }

    channel.totalViews += video.viewCount;
    channel.bestViewCount = Math.max(channel.bestViewCount, video.viewCount);
    if (channel.videos.length < MAX_VIDEOS_PER_AUTHOR) {
      channel.videos.push({
        title: video.title,
        viewsCount: video.views,
        likesCount: video.likeCount > 0 ? humanizeViewCount(video.likeCount) : undefined,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        coverUrl: video.coverUrl || undefined,
        postedAt: video.postedAt,
        videoUrl: video.videoUrl,
      });
    }
  }

  return [...channels.values()].sort((a, b) => b.bestViewCount - a.bestViewCount).slice(0, MAX_AUTHORS_PER_RUN);
}

export interface DiscoveredChannel {
  channelId: string;
  channelTitle: string;
}

/**
 * Discovers trending YouTube channels via real search.list results for a
 * small fixed set of faceless-niche keywords (no guessed URLs), and upserts
 * each into niche_channels, ready for classifyAndStoreChannel(). Ingestion
 * only -- doesn't classify, mirrors faceless-tiktok-discovery.ts.
 */
export async function discoverAndIngestTrendingYoutubeChannels(
  admin: SupabaseClient = createAdminClient()
): Promise<DiscoveredChannel[]> {
  const videos = await fetchNicheYoutubeVideos(DISCOVERY_KEYWORDS, TARGET_VIDEO_COUNT);
  const channels = groupByChannel(videos);

  const results: DiscoveredChannel[] = [];

  for (const channel of channels) {
    const { data, error } = await admin
      .from("niche_channels")
      .upsert(
        {
          platform: "youtube",
          channel_url: `https://www.youtube.com/channel/${channel.channelId}`,
          channel_title: channel.channelTitle,
          avatar_url: channel.avatarUrl || null,
          subscriber_count: channel.subscriberCount,
          total_views: channel.totalViews,
          recent_videos: channel.videos,
          niche: channel.niche,
        },
        { onConflict: "channel_url" }
      )
      .select("id, channel_title")
      .single();

    if (error || !data) {
      console.error(`[faceless-youtube-discovery] Failed to upsert channel ${channel.channelId}:`, error);
      continue;
    }

    results.push({ channelId: data.id, channelTitle: data.channel_title });
  }

  return results;
}
