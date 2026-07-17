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
const TIKTOK_DOWNLOADER_ACTOR = "api-ninja~tiktok-video-downloader";

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

function mapHashtagItems(items: TikTokHashtagItem[]): TrendingTikTokVideo[] {
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

  return videos;
}

// Per-hashtag result cap. Kept as a per-hashtag limit (rather than a global
// top-N sort) so a viral hashtag can't crowd quieter ones out of the pool —
// every niche gets its own share of results, not whatever's left after the
// loudest hashtags take the top slots.
const RESULTS_PER_HASHTAG = 100;

export async function fetchFacelessTrendingVideos(): Promise<TrendingTikTokVideo[]> {
  const items = await runActor<TikTokHashtagItem>(TIKTOK_HASHTAG_ACTOR, {
    hashtags: FACELESS_HASHTAGS,
    resultsPerPage: RESULTS_PER_HASHTAG,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    commentsPerPost: 0,
  });

  const videos = mapHashtagItems(items);

  return videos.sort((a, b) => b.viewCount - a.viewCount);
}

// Scopes the same hashtag search to a single niche's hashtags, for the
// on-demand cache-aside fetch in /api/niches/[niche]/videos. `limit` grows
// with how deep the caller has paginated (see targetCount in that route) —
// the underlying actor has no cursor/skip param, so "fetch the next batch"
// means asking for a bigger resultsPerPage and re-upserting; onConflict:"id"
// dedupes against what's already cached.
//
// timeoutMs is kept well under the API route's `maxDuration` so a slow
// Apify run fails with a clean error/JSON response instead of the platform
// silently killing the function mid-request, which is what left the
// frontend's "Fetching fresh videos…" spinner hanging forever.
export async function fetchNicheTrendingVideos(
  hashtags: string[],
  limit = 150,
  timeoutMs = 45_000
): Promise<TrendingTikTokVideo[]> {
  const perHashtag = Math.max(RESULTS_PER_HASHTAG, Math.ceil(limit / hashtags.length));
  const items = await runActor<TikTokHashtagItem>(
    TIKTOK_HASHTAG_ACTOR,
    {
      hashtags,
      resultsPerPage: perHashtag,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      commentsPerPost: 0,
    },
    timeoutMs
  );

  const videos = mapHashtagItems(items);
  return videos.sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
}

interface TikTokDownloaderResult {
  code?: number;
  msg?: string;
  data?: {
    title?: string;
    title_new?: string;
    play?: string; // no-watermark, standard quality
    hdplay?: string; // no-watermark, HD quality
    music?: string; // background audio track
    duration?: number;
    cover?: string;
  };
}

export interface TikTokDownloadLinks {
  title: string;
  videoUrl: string;
  audioUrl: string | null;
  coverUrl: string;
  durationSeconds: number;
}

// The actor also accepts profile handles/URLs and silently expands them to
// every published video on that account, billing per video returned. Reject
// anything that isn't clearly a single-video link so a pasted profile URL
// can't trigger an unbounded (and unbudgeted) bulk scrape.
const TIKTOK_VIDEO_URL_PATTERN = /tiktok\.com\/@[^/?#]+\/(video|photo)\/\d+/i;
const TIKTOK_SHORT_LINK_PATTERN = /(?:vm|vt|m)\.tiktok\.com\//i;

function assertSingleTikTokVideoUrl(url: string): void {
  if (TIKTOK_VIDEO_URL_PATTERN.test(url) || TIKTOK_SHORT_LINK_PATTERN.test(url)) return;
  throw new ApifyScraperError(
    "unsupported_url",
    "Paste a link to a single TikTok video, not a profile — profile links download every video on that account."
  );
}

// api-ninja~tiktok-video-downloader mirrors the tikwm.com response shape:
// `hdplay`/`play` are watermark-free video links, `music` is the track used
// in the video (there's no separate "video audio" — TikTok downloaders treat
// this as the mp3 download).
export async function fetchTikTokDownloadLinks(url: string): Promise<TikTokDownloadLinks> {
  assertSingleTikTokVideoUrl(url);

  const [item] = await runActor<TikTokDownloaderResult>(TIKTOK_DOWNLOADER_ACTOR, {
    videoUrls: [url],
    ttl: "none",
  });

  if (!item || item.code !== 0 || !item.data) {
    throw new ApifyScraperError("not_found", item?.msg || "That TikTok video couldn't be found.");
  }

  const videoUrl = item.data.hdplay || item.data.play;
  if (!videoUrl) {
    throw new ApifyScraperError("provider_error", "Downloader did not return a video file URL.");
  }

  return {
    title: item.data.title?.trim() || item.data.title_new?.trim() || "Untitled video",
    videoUrl,
    audioUrl: item.data.music ?? null,
    coverUrl: item.data.cover ?? "",
    durationSeconds: item.data.duration ?? 0,
  };
}
