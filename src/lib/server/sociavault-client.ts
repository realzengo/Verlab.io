import { humanizeViewCount } from "@/lib/server/apify-client";

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
  };
}

interface SociaVaultHashtagSearchResponse {
  success?: boolean;
  data?: {
    aweme_list?: SociaVaultAwemeItem[];
    cursor?: number;
    has_more?: number;
  };
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
    if (Array.isArray(data?.aweme_list)) items.push(...data.aweme_list);
    if (!data?.has_more) break;
    cursor = data.cursor ?? cursor;
  }

  return items;
}

function mapAwemeItems(items: SociaVaultAwemeItem[], hashtag: string): TrendingTikTokVideo[] {
  const seen = new Set<string>();
  const videos: TrendingTikTokVideo[] = [];

  for (const item of items) {
    const handle = item.author?.unique_id;
    if (!item.aweme_id || !handle || seen.has(item.aweme_id)) continue;
    seen.add(item.aweme_id);
    const viewCount = Number(item.statistics?.play_count) || 0;
    videos.push({
      id: item.aweme_id,
      title: item.desc?.trim().slice(0, 160) || "Untitled video",
      views: humanizeViewCount(viewCount),
      viewCount,
      likeCount: Number(item.statistics?.digg_count) || 0,
      commentCount: Number(item.statistics?.comment_count) || 0,
      shareCount: Number(item.statistics?.share_count) || 0,
      followerCount: Number(item.author?.follower_count) || 0,
      coverUrl: item.video?.cover?.url_list?.[0] ?? "",
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
// to the faceless production styles Clypa serves — narrated/voiceover niches,
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
];

// Per-hashtag result cap. Kept as a per-hashtag limit (rather than a global
// top-N sort) so a viral hashtag can't crowd quieter ones out of the pool —
// every niche gets its own share of results, not whatever's left after the
// loudest hashtags take the top slots.
const RESULTS_PER_HASHTAG = 100;

export async function fetchFacelessTrendingVideos(): Promise<TrendingTikTokVideo[]> {
  const results = await Promise.all(
    FACELESS_HASHTAGS.map(async (hashtag) => {
      const items = await searchHashtag(hashtag, RESULTS_PER_HASHTAG);
      return mapAwemeItems(items, hashtag);
    })
  );

  return results.flat().sort((a, b) => b.viewCount - a.viewCount);
}

// Scopes the same hashtag search to a single niche's hashtags, for the
// on-demand cache-aside fetch in /api/niches/[niche]/videos. `limit` grows
// with how deep the caller has paginated (see targetCount in that route).
export async function fetchNicheTrendingVideos(hashtags: string[], limit = 150): Promise<TrendingTikTokVideo[]> {
  const perHashtag = Math.max(RESULTS_PER_HASHTAG, Math.ceil(limit / hashtags.length));
  const results = await Promise.all(
    hashtags.map(async (hashtag) => {
      const items = await searchHashtag(hashtag, perHashtag);
      return mapAwemeItems(items, hashtag);
    })
  );

  return results
    .flat()
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
}
