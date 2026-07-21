import { scrapeCreatorsGet } from "./video-provider";
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Transient DNS/connection blips (e.g. getaddrinfo ENOTFOUND) surface as a
// plain TypeError from fetch, not an HTTP error — worth one quick retry
// before failing the whole channel analysis over what's usually a one-off.
const NETWORK_ERROR_RETRY_DELAYS_MS = [400, 1200];

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") throw err;
      if (!(err instanceof TypeError) || attempt >= NETWORK_ERROR_RETRY_DELAYS_MS.length) throw err;
      await sleep(NETWORK_ERROR_RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function runActor<T>(actorSlug: string, input: unknown, timeoutMs = 120_000): Promise<T[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new ApifyScraperError("not_configured", "Apify is not configured (missing APIFY_API_TOKEN).");
  }

  let response: Response;
  try {
    response = await fetchWithRetry(
      `${APIFY_BASE_URL}/acts/${actorSlug}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
  } catch (err) {
    // AbortSignal.timeout() rejects with a DOMException, and a network blip
    // that outlasts fetchWithRetry's retries rejects with a plain TypeError —
    // neither is an ApifyScraperError, so every caller up the chain (which
    // only knows how to humanize ApifyScraperError) would otherwise see a raw
    // error and fall back to a generic "something went wrong" message.
    // Normalize everything here so that boundary is guaranteed.
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApifyScraperError("provider_error", `Apify request timed out after ${timeoutMs}ms.`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ApifyScraperError("provider_error", `Could not reach Apify: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApifyScraperError(
      "provider_error",
      `Apify request failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  try {
    return (await response.json()) as T[];
  } catch {
    throw new ApifyScraperError("provider_error", "Apify returned a response we couldn't parse.");
  }
}

interface YoutubeScraperItem {
  title?: string;
  viewCount?: number | string;
  channelName?: string;
  channelAvatarUrl?: string;
  channelThumbnail?: string | { url?: string };
}

// Best-effort: different actor versions have used different field names for
// the channel avatar over time, and none of it is guaranteed to be present.
// A missing/wrong field just means the UI falls back to an initials avatar.
function pickYoutubeAvatarUrl(item: YoutubeScraperItem): string | undefined {
  if (item.channelAvatarUrl) return item.channelAvatarUrl;
  if (typeof item.channelThumbnail === "string") return item.channelThumbnail;
  return item.channelThumbnail?.url;
}

interface TiktokScraperItem {
  text?: string;
  playCount?: number | string;
  authorMeta?: { name?: string; nickName?: string; avatar?: string };
}

export interface ScrapedChannel {
  channelName: string;
  avatarUrl?: string;
  videos: NicheBendVideo[];
}

// Apify is the primary channel-scraping provider, but it's a single point of
// failure — actor deprecations, rate limits, or a missing APIFY_API_TOKEN all
// surface as the same dead end for the user ("we couldn't read that
// channel"). ScrapeCreators (already configured/used for transcript fetching
// in video-provider.ts) covers the same TikTok/YouTube profile data via a
// different backend, so on any Apify failure we retry through it before
// giving up and asking the user to paste videos manually.
export async function scrapeChannelVideos(
  url: string,
  platform: NicheBendPlatform,
  videoType: NicheBendVideoType,
  limit = 10
): Promise<ScrapedChannel> {
  try {
    return await scrapeChannelVideosViaApify(url, platform, videoType, limit);
  } catch (primaryError) {
    try {
      return await scrapeChannelVideosViaScrapeCreators(url, platform, videoType, limit);
    } catch (fallbackError) {
      console.error("[niche-bend] ScrapeCreators fallback also failed:", fallbackError);
      throw primaryError;
    }
  }
}

async function scrapeChannelVideosViaApify(
  url: string,
  platform: NicheBendPlatform,
  videoType: NicheBendVideoType,
  limit: number
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
      avatarUrl: pickYoutubeAvatarUrl(items[0]),
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
    avatarUrl: items[0].authorMeta?.avatar,
    videos: items.slice(0, limit).map((item) => ({
      title: (item.text ?? "").trim() || "Untitled",
      views: humanizeViewCount(Number(item.playCount) || 0),
    })),
  };
}

// --- ScrapeCreators fallback — same channel-scraping job as the Apify actors
// above, hit through a different backend so a single provider's outage/rate
// limit/deprecated actor doesn't dead-end the whole analysis. See
// https://docs.scrapecreators.com/v3/tiktok/profile/videos and
// https://docs.scrapecreators.com/v1/youtube/channel-videos.

interface ScrapeCreatorsTikTokProfileVideoItem {
  desc?: string;
  statistics?: { play_count?: number };
  author?: { unique_id?: string; nickname?: string; avatar_medium?: { url_list?: string[] } };
}

interface ScrapeCreatorsTikTokProfileVideosResponse {
  aweme_list?: ScrapeCreatorsTikTokProfileVideoItem[];
}

async function scrapeCreatorsTikTokChannel(url: string, limit: number): Promise<ScrapedChannel> {
  const handle = extractTikTokHandle(url);
  const data = await scrapeCreatorsGet<ScrapeCreatorsTikTokProfileVideosResponse>("/v3/tiktok/profile/videos", {
    handle,
    sort_by: "popular",
  });

  const items = data.aweme_list ?? [];
  if (items.length === 0) {
    throw new ApifyScraperError("not_found", "No videos found for that TikTok profile.");
  }

  const author = items[0].author;
  const channelName = author?.nickname?.trim() || (author?.unique_id ? `@${author.unique_id}` : `@${handle}`);

  return {
    channelName,
    avatarUrl: author?.avatar_medium?.url_list?.[0],
    videos: items.slice(0, limit).map((item) => ({
      title: (item.desc ?? "").trim() || "Untitled",
      views: humanizeViewCount(Number(item.statistics?.play_count) || 0),
    })),
  };
}

function extractYoutubeChannelParams(url: string): Record<string, string> {
  const channelIdMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/i);
  if (channelIdMatch) return { channelId: channelIdMatch[1] };
  const handleMatch = url.match(/youtube\.com\/(?:@|c\/|user\/)([^/?#]+)/i);
  if (handleMatch) return { handle: handleMatch[1].replace(/^@/, "") };
  throw new ApifyScraperError("unsupported_url", "Couldn't parse a YouTube channel from that URL.");
}

interface ScrapeCreatorsChannelInfoResponse {
  name?: string;
  avatar?: { image?: { sources?: { url?: string }[] } };
}

interface ScrapeCreatorsChannelVideoItem {
  title?: string;
  viewCountInt?: number;
}

interface ScrapeCreatorsChannelVideosResponse {
  videos?: ScrapeCreatorsChannelVideoItem[];
}

interface ScrapeCreatorsChannelShortsResponse {
  shorts?: ScrapeCreatorsChannelVideoItem[];
}

async function scrapeCreatorsYoutubeChannel(
  url: string,
  videoType: NicheBendVideoType,
  limit: number
): Promise<ScrapedChannel> {
  const channelParams = extractYoutubeChannelParams(url);
  const listPath = videoType === "shorts" ? "/v1/youtube/channel/shorts" : "/v1/youtube/channel-videos";

  const [infoRes, listRes] = await Promise.all([
    scrapeCreatorsGet<ScrapeCreatorsChannelInfoResponse>("/v1/youtube/channel", channelParams),
    scrapeCreatorsGet<ScrapeCreatorsChannelShortsResponse & ScrapeCreatorsChannelVideosResponse>(listPath, {
      ...channelParams,
      sort: "popular",
    }),
  ]);

  const items = listRes.shorts ?? listRes.videos ?? [];
  if (items.length === 0) {
    throw new ApifyScraperError("not_found", "No videos found for that YouTube channel.");
  }

  return {
    channelName: infoRes.name?.trim() || url,
    avatarUrl: infoRes.avatar?.image?.sources?.[0]?.url,
    videos: items.slice(0, limit).map((item) => ({
      title: item.title?.trim() || "Untitled",
      views: humanizeViewCount(Number(item.viewCountInt) || 0),
    })),
  };
}

async function scrapeChannelVideosViaScrapeCreators(
  url: string,
  platform: NicheBendPlatform,
  videoType: NicheBendVideoType,
  limit: number
): Promise<ScrapedChannel> {
  return platform === "youtube"
    ? scrapeCreatorsYoutubeChannel(url, videoType, limit)
    : scrapeCreatorsTikTokChannel(url, limit);
}

