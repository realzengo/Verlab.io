import type { DownloadFormat, DownloadPlatform } from "@/lib/types";

export type TranscriptPlatform = "tiktok" | "reels" | "shorts";

export interface TranscriptLineResult {
  timestamp: string;
  text: string;
}

export interface TranscriptResult {
  title: string;
  coverUrl: string;
  durationSeconds: number;
  videoUrl: string | null;
  embedUrl: string | null;
  lines: TranscriptLineResult[];
}

export interface DownloadResult {
  title: string;
  directUrl: string;
}

export type VideoProviderErrorCode =
  | "unsupported_url"
  | "rate_limited"
  | "not_found"
  | "no_captions"
  | "provider_error"
  | "not_configured";

export class VideoProviderError extends Error {
  code: VideoProviderErrorCode;

  constructor(code: VideoProviderErrorCode, message: string) {
    super(message);
    this.name = "VideoProviderError";
    this.code = code;
  }
}

// `fetch` throws a bare TypeError ("fetch failed") for transient network
// blips (DNS hiccup, connection reset) — these aren't real provider failures
// and are worth a couple of quick retries before giving up and surfacing the
// generic "something went wrong" error to the user.
const NETWORK_RETRY_ATTEMPTS = 2;
const NETWORK_RETRY_DELAY_MS = 500;

async function fetchWithRetry(input: string | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (attempt >= NETWORK_RETRY_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS * (attempt + 1)));
    }
  }
}

function humanizeVideoProviderError(error: unknown): string {
  if (error instanceof VideoProviderError) {
    switch (error.code) {
      case "unsupported_url":
        return "We couldn't recognize that link. Double-check the URL and try again.";
      case "rate_limited":
        return "We're processing a lot of requests right now — try again in a moment.";
      case "not_found":
        return "That video couldn't be found — it may be private or deleted.";
      case "no_captions":
        return "That video doesn't have any captions or subtitles available to extract.";
      case "not_configured":
        return "This feature isn't configured yet. Contact support.";
      default:
        return "Something went wrong while processing that video.";
    }
  }
  return "Something went wrong while processing that video.";
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// --- Scrape Creators — transcript extraction (TikTok, Instagram Reels, YouTube Shorts)
// Each platform needs two calls: one for the transcript text/cues, one for
// video metadata (title/cover/duration/playable URL). See
// https://docs.scrapecreators.com if calls start failing with unexpected shapes.

const SCRAPECREATORS_BASE_URL = "https://api.scrapecreators.com";

async function scrapeCreatorsGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) {
    throw new VideoProviderError("not_configured", "Missing SCRAPECREATORS_API_KEY");
  }

  const endpoint = new URL(path, SCRAPECREATORS_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    endpoint.searchParams.set(key, value);
  }

  const response = await fetchWithRetry(endpoint, {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(60_000),
  });

  if (response.status === 404) {
    throw new VideoProviderError("not_found", "Video not found");
  }
  if (response.status === 429) {
    throw new VideoProviderError("rate_limited", "Rate limited by provider");
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new VideoProviderError(
      "provider_error",
      `Scrape Creators returned ${response.status}: ${body.slice(0, 300)}`
    );
  }

  return (await response.json()) as T;
}

// Shared parser for both SRT and WebVTT cue blocks: a timing line containing
// "-->" followed by one or more text lines, blocks separated by blank lines.
// SRT's leading numeric index line and VTT's "WEBVTT" header are both
// harmlessly ignored since neither contains "-->".
function parseSubtitleTimestamp(raw: string): number {
  // Not all actors zero-pad seconds/minutes (e.g. "00:00:0,000"), so accept
  // 1-2 digits per component rather than requiring strict SRT/VTT widths.
  const match = raw.trim().match(/(\d+):(\d{1,2}):(\d{1,2})[.,](\d{1,3})/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, "0")) / 1000;
}

function parseSubtitles(raw: string): TranscriptLineResult[] {
  const lines: TranscriptLineResult[] = [];
  const blocks = raw.replace(/\r/g, "").split(/\n\n+/);
  for (const block of blocks) {
    const blockLines = block.split("\n").filter((line) => line.trim().length > 0);
    const cueLineIndex = blockLines.findIndex((line) => line.includes("-->"));
    if (cueLineIndex === -1) continue;
    const [startRaw] = blockLines[cueLineIndex].split("-->");
    const text = blockLines
      .slice(cueLineIndex + 1)
      .join(" ")
      .trim();
    if (!text) continue;
    lines.push({ timestamp: formatTimestamp(parseSubtitleTimestamp(startRaw)), text });
  }
  return lines;
}

interface ScrapeCreatorsUrlList {
  url_list?: string[];
}

// TikTok's cover url_list mixes HEIC and JPEG variants of the same image
// (HEIC first) — <img> tags can't decode HEIC in most browsers, so prefer a
// JPEG/PNG/WEBP entry when one exists instead of always taking url_list[0].
function pickBrowserImageUrl(urlList: string[] | undefined): string | undefined {
  if (!urlList?.length) return undefined;
  return urlList.find((url) => /\.(jpe?g|png|webp)(\?|$)/i.test(url)) ?? urlList[0];
}

interface ScrapeCreatorsTikTokTranscript {
  transcript?: string; // WEBVTT
}

interface ScrapeCreatorsTikTokVideo {
  aweme_detail?: {
    desc?: string;
    author?: {
      nickname?: string;
      unique_id?: string;
    };
    statistics?: {
      digg_count?: number;
      comment_count?: number;
    };
    video?: {
      duration?: number; // ms
      cover?: ScrapeCreatorsUrlList;
      origin_cover?: ScrapeCreatorsUrlList;
      play_addr?: ScrapeCreatorsUrlList;
      download_no_watermark_addr?: ScrapeCreatorsUrlList;
      cla_info?: {
        original_language_info?: {
          language_code?: string;
        };
      };
    };
  };
}

async function scrapeCreatorsFetchTikTokTranscript(url: string): Promise<TranscriptResult> {
  // Fetch video metadata first: without an explicit `language`, the
  // transcript endpoint defaults to serving TikTok's auto-translated (often
  // English) caption track instead of the video's own spoken language. The
  // video metadata call exposes that original language code, so we pass it
  // through explicitly to get the true original-language transcript.
  const videoRes = await scrapeCreatorsGet<ScrapeCreatorsTikTokVideo>("/v2/tiktok/video", { url });
  const originalLanguage = videoRes.aweme_detail?.video?.cla_info?.original_language_info?.language_code;

  const transcriptParams: Record<string, string> = { url };
  if (originalLanguage) transcriptParams.language = originalLanguage;

  const transcriptRes = await scrapeCreatorsGet<ScrapeCreatorsTikTokTranscript>(
    "/v1/tiktok/video/transcript",
    transcriptParams
  );

  const lines = parseSubtitles(transcriptRes.transcript ?? "");
  if (lines.length === 0) {
    throw new VideoProviderError("no_captions", "No transcript available for that video");
  }

  const video = videoRes.aweme_detail?.video;

  return {
    title: videoRes.aweme_detail?.desc?.trim() || "Untitled video",
    coverUrl: pickBrowserImageUrl(video?.cover?.url_list) ?? pickBrowserImageUrl(video?.origin_cover?.url_list) ?? "",
    durationSeconds: video?.duration ? Math.round(video.duration / 1000) : 0,
    videoUrl: video?.download_no_watermark_addr?.url_list?.[0] ?? video?.play_addr?.url_list?.[0] ?? null,
    embedUrl: null,
    lines,
  };
}

interface ScrapeCreatorsYoutubeTranscriptSegment {
  text?: string;
  startMs?: string;
}

interface ScrapeCreatorsYoutubeTranscript {
  transcript?: ScrapeCreatorsYoutubeTranscriptSegment[];
}

interface ScrapeCreatorsYoutubeCaptionTrack {
  languageCode?: string;
  kind?: string; // "asr" marks the auto-generated track transcribed from actual speech (the original language)
}

interface ScrapeCreatorsYoutubeVideo {
  id?: string;
  title?: string;
  thumbnail?: string;
  durationMs?: number;
  captionTracks?: ScrapeCreatorsYoutubeCaptionTrack[];
}

function extractYoutubeVideoId(rawUrl: string): string | null {
  const shortsOrShortLink = rawUrl.match(/(?:youtube\.com\/shorts\/|youtu\.be\/)([\w-]{6,})/i);
  if (shortsOrShortLink) return shortsOrShortLink[1];
  const watch = rawUrl.match(/[?&]v=([\w-]{6,})/i);
  return watch ? watch[1] : null;
}

async function scrapeCreatorsFetchYoutubeShortsTranscript(url: string): Promise<TranscriptResult> {
  // Fetch video metadata first so we can pin the transcript request to the
  // "asr" (auto-generated from speech) caption track's language — otherwise
  // the transcript endpoint's default can hand back an auto-translated
  // track instead of the video's actual spoken language.
  const videoRes = await scrapeCreatorsGet<ScrapeCreatorsYoutubeVideo>("/v1/youtube/video", { url });
  const originalLanguage =
    videoRes.captionTracks?.find((track) => track.kind === "asr")?.languageCode ??
    videoRes.captionTracks?.[0]?.languageCode;

  const transcriptParams: Record<string, string> = { url };
  if (originalLanguage) transcriptParams.language = originalLanguage;

  const transcriptRes = await scrapeCreatorsGet<ScrapeCreatorsYoutubeTranscript>(
    "/v1/youtube/video/transcript",
    transcriptParams
  );

  const lines: TranscriptLineResult[] = (transcriptRes.transcript ?? [])
    .filter((segment) => segment.text?.trim())
    .map((segment) => ({
      timestamp: formatTimestamp(Number(segment.startMs ?? 0) / 1000),
      text: segment.text!.trim(),
    }));

  if (lines.length === 0) {
    throw new VideoProviderError("no_captions", "No transcript available for that video");
  }

  const videoId = videoRes.id ?? extractYoutubeVideoId(url);

  return {
    title: videoRes.title?.trim() || "Untitled video",
    coverUrl: videoRes.thumbnail ?? "",
    durationSeconds: videoRes.durationMs ? Math.round(videoRes.durationMs / 1000) : 0,
    videoUrl: null,
    embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : null,
    lines,
  };
}

interface ScrapeCreatorsInstagramTranscript {
  transcripts?: { text?: string }[];
}

interface ScrapeCreatorsInstagramPost {
  data?: {
    xdt_shortcode_media?: {
      video_url?: string;
      display_url?: string;
      thumbnail_src?: string;
      video_duration?: number;
      owner?: { username?: string };
      edge_media_preview_like?: { count?: number };
      edge_media_to_comment?: { count?: number };
      edge_media_to_parent_comment?: { count?: number };
      edge_media_to_caption?: { edges?: { node?: { text?: string } }[] };
    };
  };
}

async function scrapeCreatorsFetchInstagramTranscript(url: string): Promise<TranscriptResult> {
  const [transcriptRes, postRes] = await Promise.all([
    scrapeCreatorsGet<ScrapeCreatorsInstagramTranscript>("/v2/instagram/media/transcript", { url }),
    scrapeCreatorsGet<ScrapeCreatorsInstagramPost>("/v1/instagram/post", { url }),
  ]);

  const text = transcriptRes.transcripts?.[0]?.text?.trim();
  if (!text) {
    throw new VideoProviderError("no_captions", "No transcript available for that video");
  }

  const media = postRes.data?.xdt_shortcode_media;
  const caption = media?.edge_media_to_caption?.edges?.[0]?.node?.text?.trim();

  return {
    title: caption?.slice(0, 120) || "Untitled video",
    coverUrl: media?.thumbnail_src ?? media?.display_url ?? "",
    durationSeconds: media?.video_duration ? Math.ceil(media.video_duration) : 0,
    videoUrl: media?.video_url ?? null,
    embedUrl: null,
    lines: [{ timestamp: "0:00", text }],
  };
}

// --- Lightweight preview — real title/thumbnail/author/stats, no transcript
// call and no download job started. Reuses the same Scrape Creators video/post
// metadata endpoints the transcript fetchers above call, minus the transcript
// request.

export type VideoPreviewPlatform = "tiktok" | "youtube" | "instagram";

export interface VideoPreviewResult {
  platform: VideoPreviewPlatform;
  title: string;
  author: string | null;
  thumbnailUrl: string;
  likes: string | null;
  comments: string | null;
}

function detectPreviewPlatform(rawUrl: string): VideoPreviewPlatform | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/tiktok\.com/i.test(trimmed)) return "tiktok";
  if (/(youtube\.com|youtu\.be)/i.test(trimmed)) return "youtube";
  if (/instagram\.com/i.test(trimmed)) return "instagram";
  return null;
}

function formatCompactCount(count: number | undefined): string | null {
  if (count === undefined || count === null) return null;
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}

async function scrapeCreatorsPreviewTikTok(url: string): Promise<VideoPreviewResult> {
  const videoRes = await scrapeCreatorsGet<ScrapeCreatorsTikTokVideo>("/v2/tiktok/video", { url });
  const detail = videoRes.aweme_detail;
  const video = detail?.video;
  if (!video) {
    throw new VideoProviderError("not_found", "Video not found");
  }

  return {
    platform: "tiktok",
    title: detail?.desc?.trim() || "Untitled video",
    author: detail?.author?.nickname || (detail?.author?.unique_id ? `@${detail.author.unique_id}` : null),
    thumbnailUrl: pickBrowserImageUrl(video.cover?.url_list) ?? pickBrowserImageUrl(video.origin_cover?.url_list) ?? "",
    likes: formatCompactCount(detail?.statistics?.digg_count),
    comments: formatCompactCount(detail?.statistics?.comment_count),
  };
}

async function scrapeCreatorsPreviewYoutube(url: string): Promise<VideoPreviewResult> {
  const videoRes = await scrapeCreatorsGet<ScrapeCreatorsYoutubeVideo>("/v1/youtube/video", { url });
  if (!videoRes.title && !videoRes.thumbnail) {
    throw new VideoProviderError("not_found", "Video not found");
  }

  return {
    platform: "youtube",
    title: videoRes.title?.trim() || "Untitled video",
    author: null,
    thumbnailUrl: videoRes.thumbnail ?? "",
    likes: null,
    comments: null,
  };
}

async function scrapeCreatorsPreviewInstagram(url: string): Promise<VideoPreviewResult> {
  const postRes = await scrapeCreatorsGet<ScrapeCreatorsInstagramPost>("/v1/instagram/post", { url });
  const media = postRes.data?.xdt_shortcode_media;
  if (!media) {
    throw new VideoProviderError("not_found", "Video not found");
  }

  const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text?.trim();

  return {
    platform: "instagram",
    title: caption?.slice(0, 120) || "Untitled video",
    author: media.owner?.username ? `@${media.owner.username}` : null,
    thumbnailUrl: media.thumbnail_src ?? media.display_url ?? "",
    likes: formatCompactCount(media.edge_media_preview_like?.count),
    comments: formatCompactCount(
      media.edge_media_to_comment?.count ?? media.edge_media_to_parent_comment?.count
    ),
  };
}

export async function fetchVideoPreview(url: string): Promise<VideoPreviewResult> {
  const platform = detectPreviewPlatform(url);
  switch (platform) {
    case "tiktok":
      return scrapeCreatorsPreviewTikTok(url);
    case "youtube":
      return scrapeCreatorsPreviewYoutube(url);
    case "instagram":
      return scrapeCreatorsPreviewInstagram(url);
    default:
      throw new VideoProviderError("unsupported_url", "Unsupported video URL");
  }
}

// --- video-download-api.com (p.savenow.to) — file downloads for every
// supported platform (YouTube, TikTok, Facebook). Async job API: submit to
// /ajax/download.php, then poll /ajax/progress.php (progress is in
// thousandths, 1000 = done) until download_url appears. See
// https://video-download-api.com/api/docs.
//
// Instagram is deliberately not routed here — verified against this
// provider directly and it consistently fails ("text":"Failed") for real
// Instagram post/reel URLs, unlike YouTube/TikTok/Facebook which return
// working files.

const SAVENOW_BASE_URL = "https://p.savenow.to";
const SAVENOW_POLL_INTERVAL_MS = 2_000;
const SAVENOW_POLL_TIMEOUT_MS = 180_000;

interface SavenowDownloadResponse {
  success?: boolean;
  id?: string;
  info?: { title?: string; image?: string };
}

interface SavenowProgressResponse {
  success?: number;
  progress?: number;
  download_url?: string;
  text?: string;
}

async function savenowPollForDownloadUrl(id: string, onProgress?: (percent: number) => void): Promise<string> {
  const deadline = Date.now() + SAVENOW_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await fetchWithRetry(`${SAVENOW_BASE_URL}/ajax/progress.php?id=${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new VideoProviderError("provider_error", `Video Download API progress returned ${response.status}`);
    }

    const data = (await response.json()) as SavenowProgressResponse;
    if (data.download_url && (data.progress ?? 0) >= 1000) {
      onProgress?.(100);
      return data.download_url;
    }
    // `success: 0` is the in-progress state, not a failure — it stays 0 until
    // the job actually finishes (only then does it flip to 1 alongside
    // progress reaching 1000), so it can't be used to detect a failed job.
    // A terminal "Failed" job also reports progress 1000, but with no
    // download_url — without this check it would spin here until the
    // timeout below instead of surfacing the real failure.
    if (!data.download_url && (data.progress ?? 0) >= 1000) {
      throw new VideoProviderError(
        "not_found",
        "That video couldn't be downloaded — it may be private, deleted, or unsupported."
      );
    }
    if (data.progress !== undefined) {
      onProgress?.(Math.floor(data.progress / 10));
    }

    await new Promise((resolve) => setTimeout(resolve, SAVENOW_POLL_INTERVAL_MS));
  }
  throw new VideoProviderError("provider_error", "Timed out waiting for the video to be ready");
}

async function savenowFetchDownloadLink(
  url: string,
  format: DownloadFormat,
  onProgress?: (percent: number) => void
): Promise<DownloadResult> {
  const apiKey = process.env.SAVENOW_API_KEY;
  if (!apiKey) {
    throw new VideoProviderError("not_configured", "Missing SAVENOW_API_KEY");
  }

  const endpoint = new URL("/ajax/download.php", SAVENOW_BASE_URL);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("format", format);
  endpoint.searchParams.set("apikey", apiKey);
  endpoint.searchParams.set("add_info", "1");

  const response = await fetchWithRetry(endpoint, { signal: AbortSignal.timeout(30_000) });
  if (response.status === 429) {
    throw new VideoProviderError("rate_limited", "Rate limited by provider");
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new VideoProviderError(
      "provider_error",
      `Video Download API returned ${response.status}: ${body.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as SavenowDownloadResponse;
  if (!data.success || !data.id) {
    throw new VideoProviderError("provider_error", "Video Download API did not return a job id");
  }

  const directUrl = await savenowPollForDownloadUrl(data.id, onProgress);
  return { title: data.info?.title?.trim() || "Untitled video", directUrl };
}

export function detectTranscriptPlatform(rawUrl: string): TranscriptPlatform | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/tiktok\.com/i.test(trimmed)) return "tiktok";
  if (/instagram\.com\/(reel|p)\//i.test(trimmed)) return "reels";
  if (/youtube\.com\/shorts|youtu\.be/i.test(trimmed)) return "shorts";
  return null;
}

export function detectDownloadPlatform(rawUrl: string): DownloadPlatform | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/tiktok\.com/i.test(trimmed)) return "tiktok";
  if (/(youtube\.com|youtu\.be)/i.test(trimmed)) return "youtube";
  if (/(facebook\.com|fb\.watch)/i.test(trimmed)) return "facebook";
  return null;
}

export async function fetchTranscript(url: string): Promise<TranscriptResult> {
  const platform = detectTranscriptPlatform(url);
  switch (platform) {
    case "tiktok":
      return scrapeCreatorsFetchTikTokTranscript(url);
    case "shorts":
      return scrapeCreatorsFetchYoutubeShortsTranscript(url);
    case "reels":
      return scrapeCreatorsFetchInstagramTranscript(url);
    default:
      throw new VideoProviderError("unsupported_url", "Unsupported video URL");
  }
}

export async function fetchDownloadLink(
  url: string,
  format: DownloadFormat,
  onProgress?: (percent: number) => void
): Promise<DownloadResult> {
  const platform = detectDownloadPlatform(url);
  if (!platform) {
    throw new VideoProviderError("unsupported_url", "Unsupported video URL");
  }
  return savenowFetchDownloadLink(url, format, onProgress);
}

export { humanizeVideoProviderError };
