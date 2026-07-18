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

