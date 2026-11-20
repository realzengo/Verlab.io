import "server-only";
import convertHeic from "heic-convert";
import { VideoProviderError, fetchTranscript, scrapeCreatorsGet } from "./video-provider";
import { createAdminClient, ensureBucket } from "@/lib/supabase/admin";
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
    // Token goes in the Authorization header, not a ?token= query param, so
    // it never lands in request-URL logs or traces.
    response = await fetchWithRetry(
      `${APIFY_BASE_URL}/acts/${actorSlug}/run-sync-get-dataset-items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
  url?: string;
  viewCount?: number | string;
  channelName?: string;
  channelAvatarUrl?: string;
  channelThumbnail?: string | { url?: string };
  channelId?: string;
  channelUsername?: string;
}

// Best-effort: different actor versions have used different field names for
// the channel avatar over time, and none of it is guaranteed to be present.
// A missing/wrong field just means the UI falls back to an initials avatar.
function pickYoutubeAvatarUrl(item: YoutubeScraperItem): string | undefined {
  if (item.channelAvatarUrl) return item.channelAvatarUrl;
  if (typeof item.channelThumbnail === "string") return item.channelThumbnail;
  return item.channelThumbnail?.url;
}

// Live-confirmed (2026-08): the current streamers~youtube-scraper actor
// build no longer returns *any* avatar field on its items -- channelName/
// channelUrl/channelUsername/channelId are the only channel-level fields
// present, so pickYoutubeAvatarUrl above is always undefined in practice.
// ScrapeCreators' /v1/youtube/channel endpoint (already used as the
// full-scrape fallback below) does return a real avatar, so it's worth one
// extra cheap lookup here rather than falling all the way back to an
// initials avatar for every single YouTube bend.
async function fetchYoutubeAvatarViaScrapeCreators(item: YoutubeScraperItem): Promise<string | undefined> {
  const channelParams: Record<string, string> | undefined = item.channelId
    ? { channelId: item.channelId }
    : item.channelUsername
      ? { handle: item.channelUsername }
      : undefined;
  if (!channelParams) return undefined;

  const info = await scrapeCreatorsGet<ScrapeCreatorsChannelInfoResponse>("/v1/youtube/channel", channelParams);
  return info.avatar?.image?.sources?.[0]?.url;
}

interface TiktokScraperItem {
  text?: string;
  webVideoUrl?: string;
  playCount?: number | string;
  authorMeta?: { name?: string; nickName?: string; avatar?: string };
}

// Mirrors fetchYoutubeAvatarViaScrapeCreators below: the TikTok actor
// sometimes omits authorMeta.avatar (empty string or missing field
// entirely) even though the profile has one, so it's worth one cheap
// ScrapeCreators lookup rather than falling straight to an initials avatar.
async function fetchTiktokAvatarViaScrapeCreators(handle: string): Promise<string | undefined> {
  const data = await scrapeCreatorsGet<ScrapeCreatorsTikTokProfileVideosResponse>("/v3/tiktok/profile/videos", {
    handle,
  });
  return data.aweme_list?.[0]?.author?.avatar_medium?.url_list?.[0];
}

export interface ScrapedChannelVideo extends NicheBendVideo {
  // "" when the provider didn't give one -- such videos are still listed,
  // just skipped for transcripts (see fetchTranscriptsBounded).
  url: string;
}

export interface ScrapedChannel {
  channelName: string;
  avatarUrl?: string;
  // The type actually listed. Can differ from the one asked for when a
  // YouTube channel has none of it (see listYoutubeChannelItems).
  videoType: NicheBendVideoType;
  // Highest-viewed first.
  videos: ScrapedChannelVideo[];
}

const AVATAR_BUCKET = "channel-avatars";

// Deterministic short key so re-bending the same channel URL reuses (rather
// than piles up) the same storage object.
function hashKey(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

// Both scraper backends can hand back a channel avatar hosted directly on
// the platform's own CDN. TikTok's URLs in particular are signed with a
// short (roughly one to two week) expiry baked into the URL itself
// (`x-expires`) -- live-confirmed to 403 well before "Recent bends" (which
// keeps showing old entries indefinitely) would ever be revisited. Mirroring
// the bytes into our own public bucket once, at scrape time, means the URL
// persisted to niche_bend_jobs.analysis never goes stale. Best-effort: any
// failure here just falls back to the original (eventually-expiring) URL
// rather than losing the avatar outright.
async function mirrorAvatar(sourceUrl: string, platform: NicheBendPlatform, requestUrl: string): Promise<string> {
  try {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return sourceUrl;
    let bytes = new Uint8Array(await response.arrayBuffer());
    let contentType = response.headers.get("content-type") || "image/jpeg";

    // TikTok's avatar CDN always serves HEIC (live-confirmed: even with a
    // browser-like Accept header) -- undecodable by every non-Safari
    // browser in an <img> tag, and rejected outright by the bucket's mime
    // allowlist below. Re-encode to JPEG here so it never reaches either.
    if (/hei[cf]/i.test(contentType)) {
      const jpeg = await convertHeic({ buffer: Buffer.from(bytes), format: "JPEG", quality: 0.9 });
      bytes = new Uint8Array(jpeg);
      contentType = "image/jpeg";
    }

    const admin = createAdminClient();
    await ensureBucket(admin, AVATAR_BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });

    const key = `${platform}/${hashKey(requestUrl)}.jpg`;
    const { error } = await admin.storage.from(AVATAR_BUCKET).upload(key, bytes, { contentType, upsert: true });
    if (error) return sourceUrl;

    return admin.storage.from(AVATAR_BUCKET).getPublicUrl(key).data.publicUrl;
  } catch {
    return sourceUrl;
  }
}

// ScrapeCreators is the primary channel scraper (since 2026-11-20, when the
// Apify account got blocked with "Too many outstanding invoices" and every
// bend fell through to a fallback that was itself broken). It's the provider
// transcript fetching already depends on, and its listing carries per-video
// URLs, so one listing feeds both the title list and the transcripts. Apify
// stays as the fallback so a ScrapeCreators outage isn't a dead end either.
export async function scrapeChannelVideos(
  url: string,
  platform: NicheBendPlatform,
  videoType: NicheBendVideoType,
  limit = 10
): Promise<ScrapedChannel> {
  const scraped = await (async () => {
    try {
      return await scrapeChannelVideosWithUrls(url, platform, videoType, limit);
    } catch (primaryError) {
      try {
        return await scrapeChannelVideosViaApify(url, platform, videoType, limit);
      } catch (fallbackError) {
        console.error("[niche-bend] Apify fallback also failed:", fallbackError);
        throw primaryError;
      }
    }
  })();

  if (!scraped.avatarUrl) return scraped;
  return { ...scraped, avatarUrl: await mirrorAvatar(scraped.avatarUrl, platform, url) };
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

    const avatarUrl = pickYoutubeAvatarUrl(items[0]) ?? (await fetchYoutubeAvatarViaScrapeCreators(items[0]).catch(() => undefined));

    return {
      channelName: items[0].channelName?.trim() || url,
      avatarUrl,
      videoType,
      videos: items.slice(0, limit).map((item) => ({
        title: item.title ?? "Untitled",
        views: humanizeViewCount(Number(item.viewCount) || 0),
        url: item.url ?? "",
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

  const avatarUrl =
    items[0].authorMeta?.avatar || (await fetchTiktokAvatarViaScrapeCreators(handle).catch(() => undefined));

  return {
    channelName,
    avatarUrl,
    videoType,
    videos: items.slice(0, limit).map((item) => ({
      title: (item.text ?? "").trim() || "Untitled",
      views: humanizeViewCount(Number(item.playCount) || 0),
      url: item.webVideoUrl ?? "",
    })),
  };
}

// --- ScrapeCreators channel listing (primary scraper, see scrapeChannelVideos).
// Every listing keeps a per-video URL so the same call can feed transcript
// fetching too (niche-bend research and analyze_creator). See
// https://docs.scrapecreators.com/v3/tiktok/profile/videos and
// https://docs.scrapecreators.com/v1/youtube/channel-videos.

export type CreatorPlatform = "tiktok" | "youtube";

export function detectCreatorPlatform(url: string): CreatorPlatform | null {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  return null;
}

// Kept so existing imports keep working: every scraper returns URLs now.
export type ScrapedChannelWithUrls = ScrapedChannel;

interface ScrapeCreatorsTikTokProfileVideoItem {
  aweme_id?: string;
  desc?: string;
  share_url?: string;
  statistics?: { play_count?: number };
  author?: { unique_id?: string; nickname?: string; avatar_medium?: { url_list?: string[] } };
}

interface ScrapeCreatorsTikTokProfileVideosResponse {
  aweme_list?: ScrapeCreatorsTikTokProfileVideoItem[];
}

async function scrapeCreatorsTikTokChannel(
  url: string,
  videoType: NicheBendVideoType,
  limit: number
): Promise<ScrapedChannel> {
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
    videoType,
    videos: items.slice(0, limit).map((item) => ({
      title: (item.desc ?? "").trim() || "Untitled",
      views: humanizeViewCount(Number(item.statistics?.play_count) || 0),
      url: item.share_url ?? "",
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
  id?: string;
  title?: string;
  viewCountInt?: number;
}

// Both listing endpoints send every shelf key on every response (live-
// checked 2026-11-20: /channel-videos returns `shorts: []` next to its real
// `videos`, /channel/shorts returns `videos: []` next to `shorts`). The list
// has to be picked by endpoint: the old `shorts ?? videos` always got the
// empty array, so every long-form channel came back with "no videos".
interface ScrapeCreatorsChannelListResponse {
  videos?: ScrapeCreatorsChannelVideoItem[];
  shorts?: ScrapeCreatorsChannelVideoItem[];
}

async function listYoutubeChannelType(
  channelParams: Record<string, string>,
  videoType: NicheBendVideoType
): Promise<ScrapeCreatorsChannelVideoItem[]> {
  const path = videoType === "shorts" ? "/v1/youtube/channel/shorts" : "/v1/youtube/channel-videos";
  const pick = (res: ScrapeCreatorsChannelListResponse) => (videoType === "shorts" ? res.shorts : res.videos) ?? [];

  const list = async (params: Record<string, string>) =>
    pick(await scrapeCreatorsGet<ScrapeCreatorsChannelListResponse>(path, params));

  let items: ScrapeCreatorsChannelVideoItem[] = [];
  try {
    items = await list({ ...channelParams, sort: "popular" });
  } catch (error) {
    // YouTube only has a "Popular" sort on channels with enough uploads. On a
    // small channel ScrapeCreators answers 500 ("popular sort continuation
    // token not found" / "Shorts advertised an invalid continuation token").
    if (!(error instanceof VideoProviderError) || error.code !== "provider_error") throw error;
  }
  // Covers that 500, and the listing sometimes coming back "success" but
  // empty on a channel that has plenty (seen live on @veritasium 2026-11-20).
  // The default listing works in both cases; the sort below ranks it by views.
  if (items.length === 0) items = await list(channelParams);

  return [...items].sort((a, b) => (Number(b.viewCountInt) || 0) - (Number(a.viewCountInt) || 0));
}

// The picker defaults to Long-form, and plenty of faceless channels post only
// Shorts (or the reverse). When the chosen type is empty, list the other one
// instead of failing the whole bend.
async function listYoutubeChannelItems(
  channelParams: Record<string, string>,
  videoType: NicheBendVideoType
): Promise<{ items: ScrapeCreatorsChannelVideoItem[]; videoType: NicheBendVideoType }> {
  const items = await listYoutubeChannelType(channelParams, videoType);
  if (items.length > 0) return { items, videoType };

  const otherType: NicheBendVideoType = videoType === "shorts" ? "long-form" : "shorts";
  const otherItems = await listYoutubeChannelType(channelParams, otherType).catch((error) => {
    console.error(`[scrape] ${otherType} listing fallback failed:`, error);
    return [];
  });
  return otherItems.length > 0 ? { items: otherItems, videoType: otherType } : { items, videoType };
}

async function scrapeCreatorsYoutubeChannel(
  url: string,
  videoType: NicheBendVideoType,
  limit: number
): Promise<ScrapedChannel> {
  const channelParams = extractYoutubeChannelParams(url);

  const [infoRes, listing] = await Promise.all([
    scrapeCreatorsGet<ScrapeCreatorsChannelInfoResponse>("/v1/youtube/channel", channelParams),
    listYoutubeChannelItems(channelParams, videoType),
  ]);

  if (listing.items.length === 0) {
    throw new ApifyScraperError("not_found", "No videos found for that YouTube channel.");
  }

  // The listing's own `url` field is unreliable (the shorts listing returns a
  // plain watch?v=... link instead of a /shorts/ path), so it's rebuilt from
  // the video `id`, which both endpoints always return correctly.
  const buildUrl = (id: string) =>
    listing.videoType === "shorts" ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;

  return {
    channelName: infoRes.name?.trim() || url,
    avatarUrl: infoRes.avatar?.image?.sources?.[0]?.url,
    videoType: listing.videoType,
    videos: listing.items.slice(0, limit).map((item) => ({
      title: item.title?.trim() || "Untitled",
      views: humanizeViewCount(Number(item.viewCountInt) || 0),
      url: item.id ? buildUrl(item.id) : "",
    })),
  };
}

export async function scrapeChannelVideosWithUrls(
  url: string,
  platform: CreatorPlatform,
  videoType: NicheBendVideoType,
  limit = 5
): Promise<ScrapedChannel> {
  return platform === "youtube"
    ? scrapeCreatorsYoutubeChannel(url, videoType, limit)
    : scrapeCreatorsTikTokChannel(url, videoType, limit);
}

// One-off repair for history rows that were scraped before the TikTok/
// YouTube avatar-fallback lookups above existed (or before either actor
// started omitting the field) -- those rows have channelName/videos but no
// avatarUrl, and would otherwise show the initials placeholder forever
// since re-scraping only happens on a fresh bend. Cheap: a single profile
// lookup, no video list. Best-effort by design (callers already swallow
// failures) -- a lookup miss just leaves the row as-is for next time.
export async function backfillAvatarUrl(sourceUrl: string, platform: NicheBendPlatform): Promise<string | undefined> {
  const rawAvatarUrl =
    platform === "youtube"
      ? (
          await scrapeCreatorsGet<ScrapeCreatorsChannelInfoResponse>(
            "/v1/youtube/channel",
            extractYoutubeChannelParams(sourceUrl)
          )
        ).avatar?.image?.sources?.[0]?.url
      : await fetchTiktokAvatarViaScrapeCreators(extractTikTokHandle(sourceUrl));

  if (!rawAvatarUrl) return undefined;
  return mirrorAvatar(rawAvatarUrl, platform, sourceUrl);
}

// Bounded-concurrency transcript fetching, shared by analyze_creator and
// niche-bend's transcript-grounded research. fetchTranscript() takes up to
// ~120s per call (two chained ScrapeCreators requests, each with its own
// 60s timeout) -- fully sequential over 5 videos could take 600s, well past
// any caller's route-level maxDuration. A small worker pool caps concurrency,
// and the wall-clock budget below guarantees this function returns whatever
// transcripts are ready by then rather than blocking on the slowest one:
// `results` is captured by reference, so a still-running worker keeps
// pushing into it harmlessly after the race resolves, but nobody's waiting
// on it anymore.
export async function fetchTranscriptsBounded(
  videos: ScrapedChannelVideo[],
  concurrency: number,
  wallClockBudgetMs = 110_000
): Promise<{ video: ScrapedChannelVideo; text: string }[]> {
  const queue = videos.filter((video) => video.url);
  const results: { video: ScrapedChannelVideo; text: string }[] = [];

  async function worker() {
    for (let video = queue.shift(); video; video = queue.shift()) {
      try {
        const result = await fetchTranscript(video.url);
        results.push({ video, text: result.lines.map((line) => line.text).join(" ") });
      } catch (error) {
        console.error(`[transcripts] fetch failed for ${video.url}:`, error);
      }
    }
  }

  const workDone = Promise.all(Array.from({ length: concurrency }, worker));
  const budgetElapsed = new Promise<void>((resolve) => setTimeout(resolve, wallClockBudgetMs));
  await Promise.race([workDone, budgetElapsed]);
  return results;
}

