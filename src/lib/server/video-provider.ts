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

export type VideoProviderErrorCode = "unsupported_url" | "rate_limited" | "not_found" | "provider_error" | "not_configured";

export class VideoProviderError extends Error {
  code: VideoProviderErrorCode;

  constructor(code: VideoProviderErrorCode, message: string) {
    super(message);
    this.name = "VideoProviderError";
    this.code = code;
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

  const response = await fetch(endpoint, {
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

interface ScrapeCreatorsTikTokTranscript {
  transcript?: string; // WEBVTT
}

interface ScrapeCreatorsTikTokVideo {
  aweme_detail?: {
    desc?: string;
    video?: {
      duration?: number; // ms
      cover?: ScrapeCreatorsUrlList;
      origin_cover?: ScrapeCreatorsUrlList;
      play_addr?: ScrapeCreatorsUrlList;
      download_no_watermark_addr?: ScrapeCreatorsUrlList;
    };
  };
}

async function scrapeCreatorsFetchTikTokTranscript(url: string): Promise<TranscriptResult> {
  const [transcriptRes, videoRes] = await Promise.all([
    scrapeCreatorsGet<ScrapeCreatorsTikTokTranscript>("/v1/tiktok/video/transcript", { url }),
    scrapeCreatorsGet<ScrapeCreatorsTikTokVideo>("/v2/tiktok/video", { url }),
  ]);

  const lines = parseSubtitles(transcriptRes.transcript ?? "");
  if (lines.length === 0) {
    throw new VideoProviderError("not_found", "No transcript available for that video");
  }

  const video = videoRes.aweme_detail?.video;

  return {
    title: videoRes.aweme_detail?.desc?.trim() || "Untitled video",
    coverUrl: video?.cover?.url_list?.[0] ?? video?.origin_cover?.url_list?.[0] ?? "",
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

interface ScrapeCreatorsYoutubeVideo {
  id?: string;
  title?: string;
  thumbnail?: string;
  durationMs?: number;
}

function extractYoutubeVideoId(rawUrl: string): string | null {
  const shortsOrShortLink = rawUrl.match(/(?:youtube\.com\/shorts\/|youtu\.be\/)([\w-]{6,})/i);
  if (shortsOrShortLink) return shortsOrShortLink[1];
  const watch = rawUrl.match(/[?&]v=([\w-]{6,})/i);
  return watch ? watch[1] : null;
}

async function scrapeCreatorsFetchYoutubeShortsTranscript(url: string): Promise<TranscriptResult> {
  const [transcriptRes, videoRes] = await Promise.all([
    scrapeCreatorsGet<ScrapeCreatorsYoutubeTranscript>("/v1/youtube/video/transcript", { url }),
    scrapeCreatorsGet<ScrapeCreatorsYoutubeVideo>("/v1/youtube/video", { url }),
  ]);

  const lines: TranscriptLineResult[] = (transcriptRes.transcript ?? [])
    .filter((segment) => segment.text?.trim())
    .map((segment) => ({
      timestamp: formatTimestamp(Number(segment.startMs ?? 0) / 1000),
      text: segment.text!.trim(),
    }));

  if (lines.length === 0) {
    throw new VideoProviderError("not_found", "No transcript available for that video");
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
    throw new VideoProviderError("not_found", "No transcript available for that video");
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

// --- Generic downloader aggregator — video/audio file resolution ----------
// Transcript extraction (above) and raw file downloading are different
// vendor categories (Supadata focuses on transcripts/metadata, not file
// downloads). VIDEO_PROVIDER selects which downloader backend to call;
// swap the request below for your chosen vendor's actual endpoint shape.

async function genericFetchDownloadLink(url: string, format: DownloadFormat): Promise<DownloadResult> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    throw new VideoProviderError("not_configured", "Missing SUPADATA_API_KEY");
  }

  const endpoint = new URL("https://api.supadata.ai/v1/download");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("format", format);

  const response = await fetch(endpoint, {
    headers: { "x-api-key": apiKey },
  });

  if (response.status === 404) {
    throw new VideoProviderError("not_found", "Video not found");
  }
  if (response.status === 429) {
    throw new VideoProviderError("rate_limited", "Rate limited by provider");
  }
  if (!response.ok) {
    throw new VideoProviderError("provider_error", `Provider returned ${response.status}`);
  }

  const data = await response.json();

  if (!data.url) {
    throw new VideoProviderError("provider_error", "Provider response missing a download URL");
  }

  return { title: data.title ?? "Untitled video", directUrl: data.url };
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
  if (/instagram\.com/i.test(trimmed)) return "instagram";
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

export async function fetchDownloadLink(url: string, format: DownloadFormat): Promise<DownloadResult> {
  const provider = process.env.VIDEO_PROVIDER ?? "supadata";
  if (provider !== "supadata") {
    throw new VideoProviderError("not_configured", `Unknown VIDEO_PROVIDER "${provider}"`);
  }
  return genericFetchDownloadLink(url, format);
}

export { humanizeVideoProviderError };
