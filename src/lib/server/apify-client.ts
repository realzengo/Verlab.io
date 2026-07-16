import type { NicheBendPlatform, NicheBendVideo, NicheBendVideoType } from "@/lib/types";

export type ApifyScraperErrorCode = "not_configured" | "unsupported_url" | "not_found" | "provider_error";

export class ApifyScraperError extends Error {
  code: ApifyScraperErrorCode;

  constructor(code: ApifyScraperErrorCode, message: string) {
    super(message);
    this.name = "ApifyScraperError";
    this.code = code;
  }
}

const APIFY_BASE_URL = "https://api.apify.com/v2";
const YOUTUBE_ACTOR = "streamers~youtube-scraper";
const TIKTOK_ACTOR = "clockworks~tiktok-profile-scraper";
const TIKTOK_HASHTAG_ACTOR = "clockworks~tiktok-scraper";

export function humanizeViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}

function extractTikTokHandle(url: string): string {
  const match = url.match(/tiktok\.com\/@([^/?#]+)/i);
  if (match) return match[1];
  const trimmed = url.trim().replace(/^@/, "");
  if (!trimmed || /[\s/]/.test(trimmed)) {
    throw new ApifyScraperError("unsupported_url", "Couldn't parse a TikTok username from that URL.");
  }
  return trimmed;
}

async function runActor<T>(actorSlug: string, input: unknown): Promise<T[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new ApifyScraperError("not_configured", "Apify is not configured (missing APIFY_API_TOKEN).");
  }

  const response = await fetch(
    `${APIFY_BASE_URL}/acts/${actorSlug}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(120_000),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApifyScraperError(
      "provider_error",
      `Apify request failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  return (await response.json()) as T[];
}

interface YoutubeScraperItem {
  title?: string;
  viewCount?: number | string;
  channelName?: string;
}

interface TiktokScraperItem {
  text?: string;
  playCount?: number | string;
  authorMeta?: { name?: string; nickName?: string };
}

export interface ScrapedChannel {
  channelName: string;
  videos: NicheBendVideo[];
}

export async function scrapeChannelVideos(
  url: string,
  platform: NicheBendPlatform,
  videoType: NicheBendVideoType,
  limit = 10
): Promise<ScrapedChannel> {
  if (platform === "youtube") {
    const items = await runActor<YoutubeScraperItem>(YOUTUBE_ACTOR, {
      startUrls: [{ url }],
      sortVideosBy: "POPULAR",
      maxResults: videoType === "long-form" ? limit : 0,
      maxResultsShorts: videoType === "shorts" ? limit : 0,
      maxResultStreams: 0,
    });

    if (items.length === 0) {
      throw new ApifyScraperError("not_found", "No videos found for that YouTube channel.");
    }

    return {
      channelName: items[0].channelName?.trim() || url,
      videos: items.slice(0, limit).map((item) => ({
        title: item.title ?? "Untitled",
        views: humanizeViewCount(Number(item.viewCount) || 0),
      })),
    };
  }

  const handle = extractTikTokHandle(url);
  const items = await runActor<TiktokScraperItem>(TIKTOK_ACTOR, {
    profiles: [handle],
    profileScrapeSections: ["videos"],
    profileSorting: "popular",
    resultsPerPage: limit,
    excludePinnedPosts: false,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    commentsPerPost: 0,
    topLevelCommentsPerPost: 0,
    maxRepliesPerComment: 0,
  });

  if (items.length === 0) {
    throw new ApifyScraperError("not_found", "No videos found for that TikTok profile.");
  }

  const channelName =
    items[0].authorMeta?.nickName?.trim() || items[0].authorMeta?.name?.trim() || `@${handle}`;

  return {
    channelName,
    videos: items.slice(0, limit).map((item) => ({
      title: (item.text ?? "").trim() || "Untitled",
      views: humanizeViewCount(Number(item.playCount) || 0),
    })),
  };
}

export interface TrendingTikTokVideo {
  id: string;
  title: string;
  views: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  followerCount: number;
  coverUrl: string;
  videoUrl: string;
  author: string;
  avatarUrl: string;
  hashtag: string;
  postedAt: string | null;
}

// Global "trending" feeds skew toward music/dance/celebrity content, which is
// irrelevant to a faceless-content tool. Instead we search hashtags specific
// to the faceless production styles Clypa serves — narrated/voiceover niches,
// AI-generated content, and 2D animation — so every result is on-topic.
const FACELESS_HASHTAGS = [
  "truecrime",
  "historyfacts",
  "factsyoudidntknow",
  "businessfacts",
  "aigenerated",
  "aistorytime",
  "2danimation",
  "animatedstory",
  "redditstories",
  "scarystories",
  "conspiracytheory",
  "psychologyfacts",
  "mysteryfacts",
  "aivoiceover",
  "motivationalstory",
  "didyouknowfacts",
];

interface TikTokHashtagItem {
  id?: string;
  text?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  createTimeISO?: string;
  createTime?: number;
  webVideoUrl?: string;
  authorMeta?: { name?: string; nickName?: string; avatar?: string; fans?: number };
  videoMeta?: { coverUrl?: string };
  searchHashtag?: { name?: string };
}

export async function fetchFacelessTrendingVideos(limit = 200): Promise<TrendingTikTokVideo[]> {
  const items = await runActor<TikTokHashtagItem>(TIKTOK_HASHTAG_ACTOR, {
    hashtags: FACELESS_HASHTAGS,
    resultsPerPage: 30,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    commentsPerPost: 0,
  });

  const seen = new Set<string>();
  const videos: TrendingTikTokVideo[] = [];

  for (const item of items) {
    if (!item.id || !item.webVideoUrl || seen.has(item.id)) continue;
    seen.add(item.id);
    const viewCount = Number(item.playCount) || 0;
    const postedAt =
      item.createTimeISO ?? (item.createTime ? new Date(item.createTime * 1000).toISOString() : null);
    videos.push({
      id: item.id,
      title: item.text?.trim().slice(0, 160) || "Untitled video",
      views: humanizeViewCount(viewCount),
      viewCount,
      likeCount: Number(item.diggCount) || 0,
      commentCount: Number(item.commentCount) || 0,
      shareCount: Number(item.shareCount) || 0,
      followerCount: Number(item.authorMeta?.fans) || 0,
      coverUrl: item.videoMeta?.coverUrl ?? "",
      videoUrl: item.webVideoUrl,
      author: item.authorMeta?.nickName?.trim() || item.authorMeta?.name?.trim() || "Unknown",
      avatarUrl: item.authorMeta?.avatar ?? "",
      hashtag: item.searchHashtag?.name ?? "",
      postedAt,
    });
  }

  return videos.sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
}
