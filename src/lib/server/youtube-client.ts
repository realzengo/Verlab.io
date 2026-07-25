import { humanizeViewCount } from "@/lib/server/apify-client";

export type YoutubeErrorCode = "not_configured" | "quota_exceeded" | "provider_error";

export class YoutubeError extends Error {
  code: YoutubeErrorCode;

  constructor(code: YoutubeErrorCode, message: string) {
    super(message);
    this.name = "YoutubeError";
    this.code = code;
  }
}

const YOUTUBE_BASE_URL = "https://www.googleapis.com/youtube/v3";

interface YoutubeApiError {
  error?: { errors?: { reason?: string }[]; message?: string };
}

async function youtubeGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new YoutubeError("not_configured", "YouTube is not configured (missing YOUTUBE_API_KEY).");
  }

  // YOUTUBE_BASE_URL already has a path segment ("/youtube/v3"), so
  // `new URL(path, base)` can't be used here — a leading "/" in `path` would
  // replace the base's path instead of appending to it. Concatenate instead.
  const endpoint = new URL(`${YOUTUBE_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    endpoint.searchParams.set(key, value);
  }
  endpoint.searchParams.set("key", apiKey);

  const response = await fetch(endpoint, { signal: AbortSignal.timeout(30_000) });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as YoutubeApiError | null;
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new YoutubeError("quota_exceeded", "YouTube Data API daily quota exceeded");
    }
    throw new YoutubeError(
      "provider_error",
      `YouTube API request failed (${response.status}): ${body?.error?.message ?? "unknown error"}`
    );
  }

  return (await response.json()) as T;
}

interface YoutubeSearchItem {
  id?: { videoId?: string };
}

interface YoutubeSearchResponse {
  items?: YoutubeSearchItem[];
  nextPageToken?: string;
}

// Niche Finder's default view filters to posts from the last 30 days (see
// videoTimeWindow in NicheFinder.tsx) — sorting by all-time viewCount with no
// recency bound would only ever surface years-old evergreen videos that get
// silently filtered out by that default, making the YouTube tab look empty.
// Bounding discovery to the last 45 days (a buffer past the 30d default)
// keeps results both "trending" and actually visible under the default filter.
const DISCOVERY_WINDOW_DAYS = 45;

// search.list is 100 quota units per call regardless of maxResults (capped
// at 50/call by the API), so getting more than 50 results for a keyword
// requires paging with pageToken. Capped at 5 pages (250 results) per
// keyword so a single niche refresh can't run away with the daily quota.
const MAX_SEARCH_PAGES = 5;

async function searchVideoIdsOnce(
  query: string,
  maxResults: number,
  publishedAfter: string | null,
  regionCode: string | null
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_SEARCH_PAGES && ids.length < maxResults; page++) {
    const params: Record<string, string> = {
      part: "snippet",
      q: query,
      type: "video",
      // "any" (the default when omitted) covers both Shorts and full-length
      // videos — narrowing to "short" was silently dropping every long-form
      // faceless video from results.
      order: "viewCount",
      safeSearch: "moderate",
      maxResults: String(Math.min(50, Math.max(1, maxResults - ids.length))),
    };
    if (publishedAfter) params.publishedAfter = publishedAfter;
    if (pageToken) params.pageToken = pageToken;
    // regionCode biases relevance/ranking toward that country rather than
    // being a hard "only videos uploaded from there" filter — YouTube has no
    // way to filter by uploader country, so this is the closest the Data API
    // gets to "find videos for this country".
    if (regionCode) params.regionCode = regionCode;

    const data = await youtubeGet<YoutubeSearchResponse>("/search", params);
    for (const item of data.items ?? []) {
      if (item.id?.videoId) ids.push(item.id.videoId);
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return ids;
}

// Some niches' keywords are narrow enough that the recency-bounded search
// comes back empty (e.g. nothing published in the last 45 days). Rather than
// surface an empty niche, fall back to an all-time search so the niche still
// gets populated — the API route's own time-window filter (default 30d) will
// naturally hide anything too old once fresher results land on a later
// refresh.
async function searchVideoIds(query: string, maxResults: number, regionCode: string | null): Promise<string[]> {
  const publishedAfter = new Date(Date.now() - DISCOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const recent = await searchVideoIdsOnce(query, maxResults, publishedAfter, regionCode);
  if (recent.length > 0) return recent;

  return searchVideoIdsOnce(query, maxResults, null, regionCode);
}

interface YoutubeVideoItem {
  id?: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    channelId?: string;
    channelTitle?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface YoutubeVideosResponse {
  items?: YoutubeVideoItem[];
}

// search.list doesn't return statistics — a separate videos.list call (1
// quota unit for up to 50 ids per call) is required to get view/like counts,
// matching what the trending grid needs to sort/display by. Chunked into
// batches of 50 since searchVideoIds can now return more than that per
// keyword.
async function fetchVideoDetails(ids: string[]): Promise<YoutubeVideoItem[]> {
  const items: YoutubeVideoItem[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await youtubeGet<YoutubeVideosResponse>("/videos", {
      part: "snippet,statistics",
      id: batch.join(","),
    });
    items.push(...(data.items ?? []));
  }
  return items;
}

interface YoutubeChannelItem {
  id?: string;
  statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
}

interface YoutubeChannelsResponse {
  items?: YoutubeChannelItem[];
}

// channels.list is 1 quota unit for up to 50 ids, same batching model as
// fetchVideoDetails — chunked here since a niche's videos can span more than
// 50 distinct channels.
async function fetchChannelSubscribers(channelIds: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(channelIds)];
  const subscribers = new Map<string, number>();

  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const data = await youtubeGet<YoutubeChannelsResponse>("/channels", {
      part: "statistics",
      id: batch.join(","),
    });
    for (const item of data.items ?? []) {
      if (!item.id || item.statistics?.hiddenSubscriberCount) continue;
      subscribers.set(item.id, Number(item.statistics?.subscriberCount) || 0);
    }
  }

  return subscribers;
}

export interface TrendingYoutubeVideo {
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

function mapVideoItem(
  item: YoutubeVideoItem,
  query: string,
  subscribers: Map<string, number>
): TrendingYoutubeVideo | null {
  if (!item.id) return null;
  const viewCount = Number(item.statistics?.viewCount) || 0;
  const thumb =
    item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url;

  return {
    // Namespaced so a YouTube video id can never collide with a TikTok aweme
    // id in the shared trending_videos table (same reasoning as the
    // `platform` column, belt-and-suspenders on the primary key itself).
    id: `yt_${item.id}`,
    title: item.snippet?.title?.trim() || "Untitled video",
    views: humanizeViewCount(viewCount),
    viewCount,
    likeCount: Number(item.statistics?.likeCount) || 0,
    commentCount: Number(item.statistics?.commentCount) || 0,
    // YouTube's public API doesn't expose a share count.
    shareCount: 0,
    followerCount: item.snippet?.channelId ? subscribers.get(item.snippet.channelId) ?? 0 : 0,
    coverUrl: thumb ?? "",
    videoUrl: `https://www.youtube.com/watch?v=${item.id}`,
    author: item.snippet?.channelTitle?.trim() || "Unknown channel",
    avatarUrl: "",
    hashtag: query,
    postedAt: item.snippet?.publishedAt ?? null,
  };
}

// Scopes the search to a single niche's keywords, mirroring
// fetchNicheTrendingVideos in sociavault-client.ts — same shape, same
// "search per keyword, dedupe, sort by views" contract, so the cache-aside
// refresh logic in /api/niches/[niche]/videos can treat either provider
// interchangeably.
export async function fetchNicheYoutubeVideos(
  keywords: string[],
  limit = 150,
  regionCode: string | null = null
): Promise<TrendingYoutubeVideo[]> {
  // Uncapped at 50 (unlike before) — searchVideoIds now pages past the
  // per-request 50 result max on its own, up to MAX_SEARCH_PAGES.
  const perKeyword = Math.max(10, Math.ceil(limit / keywords.length));

  const perKeywordDetails = await Promise.all(
    keywords.map(async (keyword) => {
      const ids = await searchVideoIds(keyword, perKeyword, regionCode);
      const details = await fetchVideoDetails(ids);
      return { keyword, details };
    })
  );

  const channelIds = perKeywordDetails
    .flatMap(({ details }) => details)
    .map((item) => item.snippet?.channelId)
    .filter((id): id is string => Boolean(id));
  const subscribers = await fetchChannelSubscribers(channelIds);

  const seen = new Set<string>();
  const videos: TrendingYoutubeVideo[] = [];
  for (const { keyword, details } of perKeywordDetails) {
    for (const item of details) {
      const video = mapVideoItem(item, keyword, subscribers);
      if (!video || seen.has(video.id)) continue;
      seen.add(video.id);
      videos.push(video);
    }
  }

  return videos.sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
}
