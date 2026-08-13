import { humanizeViewCount } from "@/lib/server/apify-client";
import { isKnownHashtag } from "@/lib/niches-catalog";
import { filterEnglishOnly } from "@/lib/server/language-filter";

export type SociaVaultErrorCode = "not_configured" | "provider_error";

export class SociaVaultError extends Error {
  code: SociaVaultErrorCode;

  constructor(code: SociaVaultErrorCode, message: string) {
    super(message);
    this.name = "SociaVaultError";
    this.code = code;
  }
}

const SOCIAVAULT_BASE_URL = "https://api.sociavault.com";

interface SociaVaultAwemeItem {
  aweme_id?: string;
  desc?: string;
  create_time?: number;
  statistics?: {
    play_count?: number;
    digg_count?: number;
    comment_count?: number;
    share_count?: number;
  };
  author?: {
    unique_id?: string;
    nickname?: string;
    follower_count?: number;
    avatar_medium?: { url_list?: string[] };
    avatar_thumb?: { url_list?: string[] };
  };
  video?: {
    cover?: { url_list?: string[] };
    dynamic_cover?: { url_list?: string[] };
  };
}

interface SociaVaultHashtagSearchResponse {
  success?: boolean;
  data?: {
    // Despite the name, SociaVault serializes this as a JSON object keyed
    // "0", "1", "2"... (not a real array) — normalize with toAwemeArray
    // below rather than assuming Array.isArray/spread will work on it.
    aweme_list?: SociaVaultAwemeItem[] | Record<string, SociaVaultAwemeItem>;
    cursor?: number;
    has_more?: number;
  };
}

function toAwemeArray(
  list: SociaVaultAwemeItem[] | Record<string, SociaVaultAwemeItem> | undefined
): SociaVaultAwemeItem[] {
  if (!list) return [];
  return Array.isArray(list) ? list : Object.values(list);
}

async function searchHashtagPage(hashtag: string, cursor: number): Promise<SociaVaultHashtagSearchResponse["data"]> {
  const apiKey = process.env.SOCIAVAULT_API_KEY;
  if (!apiKey) {
    throw new SociaVaultError("not_configured", "SociaVault is not configured (missing SOCIAVAULT_API_KEY).");
  }

  const endpoint = new URL("/v1/scrape/tiktok/search/hashtag", SOCIAVAULT_BASE_URL);
  endpoint.searchParams.set("hashtag", hashtag);
  if (cursor > 0) endpoint.searchParams.set("cursor", String(cursor));

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SociaVaultError("provider_error", `Could not reach SociaVault: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new SociaVaultError(
      "provider_error",
      `SociaVault request failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  const json = (await response.json()) as SociaVaultHashtagSearchResponse;
  return json.data ?? {};
}

// SociaVault paginates a fixed page size per request rather than accepting a
// resultsPerPage param, so hitting a per-hashtag target means walking pages
// via `cursor` until either enough items are collected, the provider says
// there's nothing left, or a safety cap is hit so one hashtag can't burn
// unbounded credits chasing a target it'll never reach.
const MAX_PAGES_PER_HASHTAG = 8;

async function searchHashtag(hashtag: string, targetCount: number): Promise<SociaVaultAwemeItem[]> {
  const items: SociaVaultAwemeItem[] = [];
  let cursor = 0;

  for (let page = 0; page < MAX_PAGES_PER_HASHTAG && items.length < targetCount; page++) {
    const data = await searchHashtagPage(hashtag, cursor);
    items.push(...toAwemeArray(data?.aweme_list));
    if (!data?.has_more) break;
    cursor = data.cursor ?? cursor;
  }

  return items;
}

/**
 * Live lookup of a single arbitrary hashtag, on demand -- backs the
 * "#tag" mode of the niche finder's search box. Unlike settleHashtagSearches
 * (which fans out across our fixed FACELESS_HASHTAGS catalog), this searches
 * exactly the one hashtag the user typed, whether or not it's in that list.
 */
export async function searchTikTokHashtag(hashtag: string, targetCount: number): Promise<TrendingTikTokVideo[]> {
  const items = await searchHashtag(hashtag, targetCount);
  return filterEnglishOnly(mapAwemeItems(items, hashtag));
}

// Plain .slice(0, n) truncates by UTF-16 code unit, which can split a
// surrogate pair in half (common in real TikTok captions -- emoji, some
// non-Latin scripts). A lone surrogate then fails Postgres/PostgREST's JSON
// encoding on insert with "Unicode low surrogate must follow a high
// surrogate", which silently poisoned the *entire* batch insert this title
// was upserted in (see /api/trending-videos/refresh -- this is why the
// scheduled cron kept failing and cover URLs went stale for weeks).
function truncateSafely(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  let end = maxLength;
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return text.slice(0, end);
}

function mapAwemeItems(items: SociaVaultAwemeItem[], hashtag: string): TrendingTikTokVideo[] {
  const seen = new Set<string>();
  const videos: TrendingTikTokVideo[] = [];

  for (const item of items) {
    const handle = item.author?.unique_id;
    // A truthy-but-non-string author.unique_id (seen from the global
    // trending feed, see mapUnscopedAwemeItems below) would otherwise sail
    // through a plain truthiness check and get template-literal-coerced
    // into a broken "@[object Object]" video URL that can never resolve.
    if (!item.aweme_id || typeof handle !== "string" || !handle || seen.has(item.aweme_id)) continue;
    seen.add(item.aweme_id);
    const viewCount = Number(item.statistics?.play_count) || 0;
    videos.push({
      id: item.aweme_id,
      title: truncateSafely(item.desc?.trim() ?? "", 160) || "Untitled video",
      views: humanizeViewCount(viewCount),
      viewCount,
      likeCount: Number(item.statistics?.digg_count) || 0,
      commentCount: Number(item.statistics?.comment_count) || 0,
      shareCount: Number(item.statistics?.share_count) || 0,
      followerCount: Number(item.author?.follower_count) || 0,
      coverUrl: item.video?.cover?.url_list?.[0] ?? item.video?.dynamic_cover?.url_list?.[0] ?? "",
      videoUrl: `https://www.tiktok.com/@${handle}/video/${item.aweme_id}`,
      author: item.author?.nickname?.trim() || handle,
      avatarUrl: item.author?.avatar_medium?.url_list?.[0] ?? item.author?.avatar_thumb?.url_list?.[0] ?? "",
      hashtag,
      postedAt: item.create_time ? new Date(item.create_time * 1000).toISOString() : null,
    });
  }

  return videos;
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
// to the faceless production styles Verlab serves — narrated/voiceover niches,
// AI-generated content, and 2D animation — so every result is on-topic.
const FACELESS_HASHTAGS = [
  "historyfacts",
  "scarystories",
  "mysteryfacts",
  "truecrime",
  "businessfacts",
  "educationfacts",
  "aistorytime",
  "2danimation",
  "animatedstory",
  "redditstories",
  "motivationalstory",
  "animalfacts",
  "factsyoudidntknow",
  "didyouknowfacts",
  "engineeringfacts",
  "militaryfacts",
  "sportsfacts",
  "aigenerated",
  "aivoiceover",
  "psychologyfacts",
  "religionfacts",
  "criminalpsychology",
  "fitnessfacts",
  "healthfacts",
  "politicsfacts",
  "statsfacts",
  "gamingfacts",
  "videogamefacts",
  // 3D Animation / Movie Commentary / Whiteboard niches -- verified against
  // the real SociaVault API on 2026-08-09 (each returned real results)
  // before being added here. Keep this list in sync with NICHE_HASHTAGS in
  // lib/niches-catalog.ts (that file's the source of truth nicheForHashtag()
  // reads from -- a hashtag missing from there falls back to
  // DEFAULT_VIDEO_NICHE instead of getting its real niche label).
  "3danimation",
  "3dart",
  "blender3d",
  "moviecommentary",
  "movierecap",
  "filmtok",
  "commentarytiktok",
  "whiteboardanimation",
  "whiteboardvideo",
  // Cars / Quizzes & Trivia / Brainrot / Geography / Media / Celebrity /
  // Bodycam -- verified against the real SociaVault API on 2026-08-09
  // (each returned real results) before being added here. Same sync
  // requirement with NICHE_HASHTAGS in lib/niches-catalog.ts as above.
  "carfacts",
  "carsoftiktok",
  "cartok",
  "quiztime",
  "triviafacts",
  "guessthemovie",
  "brainrot",
  "brainrotcontent",
  "geographyfacts",
  "mapfacts",
  "movietok",
  "tvfacts",
  "celebrityfacts",
  "celebritytea",
  "bodycam",
  "bodycamfootage",
];

// Per-hashtag result cap. Kept as a per-hashtag limit (rather than a global
// top-N sort) so a viral hashtag can't crowd quieter ones out of the pool —
// every niche gets its own share of results, not whatever's left after the
// loudest hashtags take the top slots.
const RESULTS_PER_HASHTAG = 100;

// allSettled rather than all -- SociaVault's real per-hashtag latency varies
// widely under concurrent load (seen 5s to 80s across a ~28-hashtag sweep in
// practice) and occasionally trips the 30s per-request timeout in
// searchHashtagPage. With Promise.all, one slow hashtag failing sinks every
// other hashtag's already-successful results; this keeps whatever came back
// and only drops the hashtag(s) that actually failed.
async function settleHashtagSearches(hashtags: string[], perHashtag: number): Promise<TrendingTikTokVideo[]> {
  const settled = await Promise.allSettled(
    hashtags.map(async (hashtag) => {
      const items = await searchHashtag(hashtag, perHashtag);
      return mapAwemeItems(items, hashtag);
    })
  );

  const results: TrendingTikTokVideo[] = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      console.warn(`[sociavault] hashtag "${hashtags[i]}" failed, skipping:`, outcome.reason);
    }
  }

  // mapAwemeItems only dedupes *within* one hashtag's results -- a video
  // legitimately matching two searched hashtags (e.g. both "truecrime" and
  // "mysteryfacts") comes back once per hashtag here. Callers upsert this
  // batch keyed on id, and Postgres' ON CONFLICT rejects a single statement
  // touching the same row twice ("cannot affect row a second time"), so this
  // has to be deduped before it ever reaches a query.
  const seenIds = new Set<string>();
  const deduped = results.filter((video) => {
    if (seenIds.has(video.id)) return false;
    seenIds.add(video.id);
    return true;
  });

  return filterEnglishOnly(deduped);
}

export async function fetchFacelessTrendingVideos(): Promise<TrendingTikTokVideo[]> {
  const results = await settleHashtagSearches(FACELESS_HASHTAGS, RESULTS_PER_HASHTAG);
  return results.sort((a, b) => b.viewCount - a.viewCount);
}

// Scopes the same hashtag search to a single niche's hashtags, for the
// on-demand cache-aside fetch in /api/niches/[niche]/videos. `limit` grows
// with how deep the caller has paginated (see targetCount in that route).
export async function fetchNicheTrendingVideos(hashtags: string[], limit = 150): Promise<TrendingTikTokVideo[]> {
  const perHashtag = Math.max(RESULTS_PER_HASHTAG, Math.ceil(limit / hashtags.length));
  const results = await settleHashtagSearches(hashtags, perHashtag);
  return results.sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
}

interface SociaVaultProfileResponse {
  success?: boolean;
  data?: {
    success?: boolean;
    stats?: {
      followerCount?: number;
    };
  };
}

// The hashtag-search and trending-feed endpoints above always report
// author.follower_count as 0 -- verified against the real API, this isn't a
// mapping bug, TikTok's own list endpoints just omit it. This dedicated
// profile lookup is the only endpoint that returns the real number, at a
// cost of 1 SociaVault credit per call -- callers should resolve+cache it
// per handle (see tiktok-follower-cache.ts) rather than call this per video.
export async function fetchTikTokProfileFollowerCount(handle: string): Promise<number> {
  const apiKey = process.env.SOCIAVAULT_API_KEY;
  if (!apiKey) {
    throw new SociaVaultError("not_configured", "SociaVault is not configured (missing SOCIAVAULT_API_KEY).");
  }

  const endpoint = new URL("/v1/scrape/tiktok/profile", SOCIAVAULT_BASE_URL);
  endpoint.searchParams.set("handle", handle);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SociaVaultError("provider_error", `Could not reach SociaVault: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new SociaVaultError(
      "provider_error",
      `SociaVault profile request failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  const json = (await response.json()) as SociaVaultProfileResponse;
  return Number(json.data?.stats?.followerCount) || 0;
}

interface SociaVaultTrendingFeedResponse {
  success?: boolean;
  data?: {
    success?: boolean;
    aweme_list?: SociaVaultAwemeItem[] | Record<string, SociaVaultAwemeItem>;
  };
}

function captionHashtags(desc: string | undefined): string[] {
  if (!desc) return [];
  return [...desc.matchAll(/#(\w+)/g)].map((match) => match[1]);
}

// Unlike mapAwemeItems (called once per hashtag search, so every item shares
// that search's hashtag), items from the global trending feed, a keyword
// search, or a single creator's own videos aren't tied to any one hashtag --
// resolve each video's niche from whichever hashtag in its own caption
// actually matches our catalog, and leave it unmatched (rather than guessing
// via DEFAULT_VIDEO_NICHE) when none do, since most of this content is
// generic viral content outside our faceless niches entirely.
function mapUnscopedAwemeItems(items: SociaVaultAwemeItem[]): TrendingTikTokVideo[] {
  const seen = new Set<string>();
  const videos: TrendingTikTokVideo[] = [];

  for (const item of items) {
    const handle = item.author?.unique_id;
    // The global trending feed has occasionally returned a malformed
    // author.unique_id (a numeric-keyed object instead of a string) --
    // typeof guard, not just truthiness, since a truthy object would
    // otherwise sail through and produce a broken "@[object Object]" URL.
    if (!item.aweme_id || typeof handle !== "string" || !handle || seen.has(item.aweme_id)) continue;
    seen.add(item.aweme_id);
    const viewCount = Number(item.statistics?.play_count) || 0;
    const matchedHashtag = captionHashtags(item.desc).find(isKnownHashtag) ?? "";

    videos.push({
      id: item.aweme_id,
      title: truncateSafely(item.desc?.trim() ?? "", 160) || "Untitled video",
      views: humanizeViewCount(viewCount),
      viewCount,
      likeCount: Number(item.statistics?.digg_count) || 0,
      commentCount: Number(item.statistics?.comment_count) || 0,
      shareCount: Number(item.statistics?.share_count) || 0,
      followerCount: Number(item.author?.follower_count) || 0,
      coverUrl: item.video?.cover?.url_list?.[0] ?? item.video?.dynamic_cover?.url_list?.[0] ?? "",
      videoUrl: `https://www.tiktok.com/@${handle}/video/${item.aweme_id}`,
      author: item.author?.nickname?.trim() || handle,
      avatarUrl: item.author?.avatar_medium?.url_list?.[0] ?? item.author?.avatar_thumb?.url_list?.[0] ?? "",
      hashtag: matchedHashtag,
      postedAt: item.create_time ? new Date(item.create_time * 1000).toISOString() : null,
    });
  }

  return videos;
}

/**
 * Pulls TikTok's real, unfiltered trending feed (region-scoped, not
 * hashtag-scoped) -- unlike fetchFacelessTrendingVideos, this isn't limited
 * to faceless-niche content, so it reflects whatever's actually trending
 * platform-wide right now, including videos outside our niche catalog.
 * Cached for a minute via Next's fetch cache since it's billed per request
 * (1 credit) and would otherwise get re-billed on every page load/filter
 * toggle across every visitor.
 */
export async function fetchTikTokTrendingFeed(region = "US"): Promise<TrendingTikTokVideo[]> {
  const apiKey = process.env.SOCIAVAULT_API_KEY;
  if (!apiKey) {
    throw new SociaVaultError("not_configured", "SociaVault is not configured (missing SOCIAVAULT_API_KEY).");
  }

  const endpoint = new URL("/v1/scrape/tiktok/trending", SOCIAVAULT_BASE_URL);
  endpoint.searchParams.set("region", region);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(30_000),
      next: { revalidate: 60 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SociaVaultError("provider_error", `Could not reach SociaVault: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new SociaVaultError(
      "provider_error",
      `SociaVault request failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  const json = (await response.json()) as SociaVaultTrendingFeedResponse;
  return filterEnglishOnly(mapUnscopedAwemeItems(toAwemeArray(json.data?.aweme_list)));
}

interface SociaVaultKeywordSearchResponse {
  success?: boolean;
  data?: {
    // Wrapped in an `aweme_info` envelope per item (unlike the hashtag/
    // trending/profile-video endpoints above, which put the same fields
    // directly on the list item) -- unwrapped in toAwemeInfoArray below.
    search_item_list?: { aweme_info?: SociaVaultAwemeItem }[] | Record<string, { aweme_info?: SociaVaultAwemeItem }>;
    cursor?: number;
    has_more?: number;
  };
}

async function searchKeywordPage(query: string, cursor: number): Promise<SociaVaultKeywordSearchResponse["data"]> {
  const apiKey = process.env.SOCIAVAULT_API_KEY;
  if (!apiKey) {
    throw new SociaVaultError("not_configured", "SociaVault is not configured (missing SOCIAVAULT_API_KEY).");
  }

  const endpoint = new URL("/v1/scrape/tiktok/search/keyword", SOCIAVAULT_BASE_URL);
  endpoint.searchParams.set("query", query);
  if (cursor > 0) endpoint.searchParams.set("cursor", String(cursor));

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SociaVaultError("provider_error", `Could not reach SociaVault: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new SociaVaultError(
      "provider_error",
      `SociaVault request failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  const json = (await response.json()) as SociaVaultKeywordSearchResponse;
  return json.data ?? {};
}

function toAwemeInfoArray(
  list: { aweme_info?: SociaVaultAwemeItem }[] | Record<string, { aweme_info?: SociaVaultAwemeItem }> | undefined
): SociaVaultAwemeItem[] {
  if (!list) return [];
  const entries = Array.isArray(list) ? list : Object.values(list);
  return entries.map((entry) => entry.aweme_info).filter((item): item is SociaVaultAwemeItem => Boolean(item));
}

// Shared page cap for both live-search modes below (keyword and per-creator)
// -- same reasoning as MAX_PAGES_PER_HASHTAG: bounds worst-case credit spend
// per search box submission rather than walking cursors indefinitely.
const MAX_PAGES_PER_SEARCH = 8;

/**
 * Live TikTok search across all of TikTok, not scoped to our faceless
 * hashtag catalog -- backs the plain-text ("keyword") mode of the niche
 * finder's search box. This is the same universal search TikTok's own app
 * search bar runs, so it already surfaces videos matching a creator's name
 * or an untagged hashtag word, not just literal caption text.
 */
export async function searchTikTokKeyword(query: string, targetCount: number): Promise<TrendingTikTokVideo[]> {
  const items: SociaVaultAwemeItem[] = [];
  let cursor = 0;

  for (let page = 0; page < MAX_PAGES_PER_SEARCH && items.length < targetCount; page++) {
    const data = await searchKeywordPage(query, cursor);
    items.push(...toAwemeInfoArray(data?.search_item_list));
    if (!data?.has_more) break;
    cursor = data.cursor ?? cursor;
  }

  return filterEnglishOnly(mapUnscopedAwemeItems(items));
}

interface SociaVaultProfileVideosResponse {
  success?: boolean;
  data?: {
    aweme_list?: SociaVaultAwemeItem[] | Record<string, SociaVaultAwemeItem>;
    max_cursor?: string | number;
    has_more?: number;
  };
}

async function fetchProfileVideosPage(
  handle: string,
  cursor: string | number
): Promise<SociaVaultProfileVideosResponse["data"]> {
  const apiKey = process.env.SOCIAVAULT_API_KEY;
  if (!apiKey) {
    throw new SociaVaultError("not_configured", "SociaVault is not configured (missing SOCIAVAULT_API_KEY).");
  }

  const endpoint = new URL("/v1/scrape/tiktok/videos", SOCIAVAULT_BASE_URL);
  endpoint.searchParams.set("handle", handle);
  endpoint.searchParams.set("sort_by", "popular");
  if (cursor) endpoint.searchParams.set("max_cursor", String(cursor));

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SociaVaultError("provider_error", `Could not reach SociaVault: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new SociaVaultError(
      "provider_error",
      `SociaVault request failed (${response.status}): ${body.slice(0, 300)}`
    );
  }

  const json = (await response.json()) as SociaVaultProfileVideosResponse;
  return json.data ?? {};
}

/**
 * Live lookup of a single creator's own videos, by exact handle -- backs the
 * "@handle" mode of the niche finder's search box (the creator's own videos,
 * as opposed to keyword search's "videos that merely mention them").
 */
export async function searchTikTokUserVideos(handle: string, targetCount: number): Promise<TrendingTikTokVideo[]> {
  const items: SociaVaultAwemeItem[] = [];
  let cursor: string | number = 0;

  for (let page = 0; page < MAX_PAGES_PER_SEARCH && items.length < targetCount; page++) {
    const data = await fetchProfileVideosPage(handle, cursor);
    items.push(...toAwemeArray(data?.aweme_list));
    if (!data?.has_more || !data.max_cursor) break;
    cursor = data.max_cursor;
  }

  return filterEnglishOnly(mapUnscopedAwemeItems(items));
}
