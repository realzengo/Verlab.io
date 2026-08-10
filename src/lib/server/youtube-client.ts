import { humanizeViewCount } from "@/lib/server/apify-client";
import { filterByLanguage } from "@/lib/server/language-filter";

// Maps the country filter's 2-letter YouTube regionCode to that country's
// dominant YouTube-search language, in both forms the pipeline needs: an
// ISO 639-1 code for the API's own `relevanceLanguage` param (biases which
// videos search.list surfaces at all), and an ISO 639-3 code for franc-based
// post-filtering in language-filter.ts (confirms what actually got
// returned). Must stay in sync with COUNTRY_OPTIONS in NicheTopBar.tsx.
const COUNTRY_LANGUAGE: Record<string, { iso1: string; iso3: string }> = {
  US: { iso1: "en", iso3: "eng" },
  GB: { iso1: "en", iso3: "eng" },
  CA: { iso1: "en", iso3: "eng" },
  AU: { iso1: "en", iso3: "eng" },
  DE: { iso1: "de", iso3: "deu" },
  FR: { iso1: "fr", iso3: "fra" },
  IN: { iso1: "hi", iso3: "hin" },
  BR: { iso1: "pt", iso3: "por" },
  MX: { iso1: "es", iso3: "spa" },
  NL: { iso1: "nl", iso3: "nld" },
  SE: { iso1: "sv", iso3: "swe" },
  PH: { iso1: "en", iso3: "eng" },
  JP: { iso1: "ja", iso3: "jpn" },
  KR: { iso1: "ko", iso3: "kor" },
  ES: { iso1: "es", iso3: "spa" },
  IT: { iso1: "it", iso3: "ita" },
};

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
    const language = regionCode ? COUNTRY_LANGUAGE[regionCode]?.iso1 : null;
    const params: Record<string, string> = {
      part: "snippet",
      q: query,
      type: "video",
      // "any" (the default when omitted) covers both Shorts and full-length
      // videos — narrowing to "short" was silently dropping every long-form
      // faceless video from results.
      //
      // order=viewCount ignores relevanceLanguage/regionCode entirely — it
      // was returning the same globally-top-viewed (almost always English)
      // videos no matter what country was selected, since raw view count
      // swamps any language/region bias. order=relevance is what actually
      // lets language/region bias shape which videos come back at all; the
      // final list still ends up sorted by view count, just re-sorted
      // locally in fetchNicheYoutubeVideos after fetching instead of by the
      // API. Only switched when a language bias is actually in play — the
      // no-country default keeps the original viewCount-ordered discovery.
      order: language ? "relevance" : "viewCount",
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
    if (language) params.relevanceLanguage = language;

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
  contentDetails?: {
    duration?: string;
  };
}

interface YoutubeVideosResponse {
  items?: YoutubeVideoItem[];
}

// search.list doesn't return statistics — a separate videos.list call (1
// quota unit for up to 50 ids per call) is required to get view/like counts,
// matching what the trending grid needs to sort/display by. Chunked into
// batches of 50 since searchVideoIds can now return more than that per
// keyword. contentDetails is requested alongside snippet/statistics at no
// extra quota cost (videos.list is 1 unit regardless of how many `part`s are
// requested) — it's the only way to get a video's real duration, needed to
// tell an actual Shorts clip apart from a long-form video that search.list
// happened to also surface.
async function fetchVideoDetails(ids: string[]): Promise<YoutubeVideoItem[]> {
  const items: YoutubeVideoItem[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await youtubeGet<YoutubeVideosResponse>("/videos", {
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
    });
    items.push(...(data.items ?? []));
  }
  return items;
}

// YouTube expanded Shorts eligibility from 60s to 3 minutes in 2024 — 180s is
// the current real cutoff, not the older 60s rule.
const SHORTS_MAX_DURATION_SECONDS = 180;

function parseIsoDurationSeconds(iso: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
}

// The Niche Finder is a Shorts-discovery tool — search.list has no way to
// restrict results to actual Shorts (its own `videoDuration=short` bucket is
// a coarse <4min search-time filter that was previously tried and reverted,
// see searchVideoIdsOnce, because it silently dropped desired long-form
// faceless content from a *different*, unrelated search). This is a
// per-video post-fetch check instead: unparseable/missing duration is
// treated as "not a Short" and excluded, since there's no way to verify it.
function isShortsDuration(item: YoutubeVideoItem): boolean {
  const iso = item.contentDetails?.duration;
  if (!iso) return false;
  const seconds = parseIsoDurationSeconds(iso);
  return seconds !== null && seconds > 0 && seconds <= SHORTS_MAX_DURATION_SECONDS;
}

interface YoutubeChannelItem {
  id?: string;
  statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
  snippet?: {
    country?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
  };
}

interface YoutubeChannelsResponse {
  items?: YoutubeChannelItem[];
}

export interface YoutubeChannelDetails {
  subscriberCount: number;
  avatarUrl: string;
  /** The channel's self-declared country (uppercased 2-letter code), empty
   * string if the channel never set one. This is the only country signal
   * YouTube's API actually verifies against the creator's own account
   * settings -- search.list's regionCode is a relevance bias, not a filter
   * (see searchVideoIdsOnce), so this is what strict country filtering in
   * fetchNicheYoutubeVideos below matches against instead. */
  country: string;
}

// channels.list is 1 quota unit for up to 50 ids regardless of which `part`s
// are requested, same batching model as fetchVideoDetails — chunked here
// since a niche's videos can span more than 50 distinct channels. Requesting
// snippet alongside statistics is free real channel-avatar data (and the
// channel's declared country) in the same call, not an extra request.
async function fetchChannelDetails(channelIds: string[]): Promise<Map<string, YoutubeChannelDetails>> {
  const unique = [...new Set(channelIds)];
  const details = new Map<string, YoutubeChannelDetails>();

  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const data = await youtubeGet<YoutubeChannelsResponse>("/channels", {
      part: "statistics,snippet",
      id: batch.join(","),
    });
    for (const item of data.items ?? []) {
      if (!item.id) continue;
      details.set(item.id, {
        subscriberCount: item.statistics?.hiddenSubscriberCount ? 0 : Number(item.statistics?.subscriberCount) || 0,
        avatarUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
        country: item.snippet?.country?.toUpperCase() ?? "",
      });
    }
  }

  return details;
}

export interface TrendingYoutubeVideo {
  id: string;
  channelId: string;
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
  channelDetails: Map<string, YoutubeChannelDetails>,
  allowedCountries: string[] | null
): TrendingYoutubeVideo | null {
  if (!item.id || !item.snippet?.channelId) return null;
  const viewCount = Number(item.statistics?.viewCount) || 0;
  const thumb =
    item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url;
  const details = channelDetails.get(item.snippet.channelId);

  // A selected country list is a soft preference, not a hard gate: most
  // channels never set one at all (it's blank by default), so treating
  // "unset" as a mismatch was rejecting the vast majority of otherwise-good
  // candidates. Only reject when the channel DID declare a country and it's
  // not one of the selected ones -- an unset country is allowed through.
  if (allowedCountries && allowedCountries.length > 0) {
    const declaredCountry = details?.country;
    if (declaredCountry && !allowedCountries.includes(declaredCountry)) return null;
  }

  return {
    // Namespaced so a YouTube video id can never collide with a TikTok aweme
    // id in the shared trending_videos table (same reasoning as the
    // `platform` column, belt-and-suspenders on the primary key itself).
    id: `yt_${item.id}`,
    channelId: item.snippet.channelId,
    title: item.snippet?.title?.trim() || "Untitled video",
    views: humanizeViewCount(viewCount),
    viewCount,
    likeCount: Number(item.statistics?.likeCount) || 0,
    commentCount: Number(item.statistics?.commentCount) || 0,
    // YouTube's public API doesn't expose a share count.
    shareCount: 0,
    followerCount: details?.subscriberCount ?? 0,
    coverUrl: thumb ?? "",
    videoUrl: `https://www.youtube.com/watch?v=${item.id}`,
    author: item.snippet?.channelTitle?.trim() || "Unknown channel",
    avatarUrl: details?.avatarUrl ?? "",
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
  regionCodes: string[] | null = null
): Promise<TrendingYoutubeVideo[]> {
  const allowedCountries = regionCodes && regionCodes.length > 0 ? regionCodes.map((c) => c.toUpperCase()) : null;
  // search.list only accepts a single regionCode -- when multiple countries
  // are selected, the first one steers which results the API surfaces/ranks
  // at all (a relevance bias, see searchVideoIdsOnce); the full list is what
  // actually gates results, applied locally against each channel's declared
  // country in mapVideoItem.
  const regionHint = allowedCountries ? allowedCountries[0] : null;

  // Country filtering (see mapVideoItem) can still throw out a chunk of a
  // page's worth of candidates (any channel that declared a different
  // country than every selected one) -- a country-scoped request needs a
  // deeper raw candidate pool than an unscoped one to reliably still land
  // `limit` matches, mirroring why a high view-count floor also needs deeper
  // scraping (see refreshNicheVideoCache).
  const effectiveLimit = allowedCountries ? Math.max(limit, 250) : limit;

  // Uncapped at 50 (unlike before) — searchVideoIds now pages past the
  // per-request 50 result max on its own, up to MAX_SEARCH_PAGES.
  const perKeyword = Math.max(10, Math.ceil(effectiveLimit / keywords.length));

  const perKeywordDetails = await Promise.all(
    keywords.map(async (keyword) => {
      const ids = await searchVideoIds(keyword, perKeyword, regionHint);
      const details = await fetchVideoDetails(ids);
      return { keyword, details };
    })
  );

  // Shorts-only is filtered here, before channel lookups, so a long-form
  // video that search.list happened to surface doesn't also cost a wasted
  // channel-details fetch for a video that's about to be dropped anyway.
  const shortsPerKeyword = perKeywordDetails.map(({ keyword, details }) => ({
    keyword,
    details: details.filter(isShortsDuration),
  }));

  const channelIds = shortsPerKeyword
    .flatMap(({ details }) => details)
    .map((item) => item.snippet?.channelId)
    .filter((id): id is string => Boolean(id));
  const channelDetails = await fetchChannelDetails(channelIds);

  const seen = new Set<string>();
  const videos: TrendingYoutubeVideo[] = [];
  for (const { keyword, details } of shortsPerKeyword) {
    for (const item of details) {
      const video = mapVideoItem(item, keyword, channelDetails, allowedCountries);
      if (!video || seen.has(video.id)) continue;
      seen.add(video.id);
      videos.push(video);
    }
  }

  // No country selected defaults to English (the pre-country-filter
  // behavior); an unrecognized regionCode (shouldn't happen — COUNTRY_LANGUAGE
  // covers every option in NicheTopBar.tsx) also falls back to English rather
  // than skipping the filter entirely.
  const targetLanguage = regionHint ? (COUNTRY_LANGUAGE[regionHint]?.iso3 ?? "eng") : "eng";
  return filterByLanguage(videos, targetLanguage)
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
}
