import "server-only";
import type { ClipSourceFormat } from "@/lib/types";
import { detectTranscriptPlatform, type TranscriptPlatform } from "@/lib/transcript-platform";
import { pickBrowserImageUrl } from "@/lib/video-covers";

export { detectTranscriptPlatform, type TranscriptPlatform };

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
// and are worth a few retries with backoff before giving up and surfacing the
// generic "something went wrong" error to the user. A DNS resolution outage
// (getaddrinfo ENOTFOUND) can outlast a sub-second retry window, so this
// backs off exponentially rather than linearly to cover longer blips.
const NETWORK_RETRY_ATTEMPTS = 4;
const NETWORK_RETRY_BASE_DELAY_MS = 500;

async function fetchWithRetry(input: string | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (attempt >= NETWORK_RETRY_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_BASE_DELAY_MS * 2 ** attempt));
    }
  }
}

function humanizeVideoProviderError(error: unknown): string {
  if (error instanceof VideoProviderError) {
    switch (error.code) {
      case "unsupported_url":
        return "We couldn't recognize that link. Double-check the URL and try again.";
      case "rate_limited":
        return "We're processing a lot of requests right now. Try again in a moment.";
      case "not_found":
        return "That video couldn't be found. It may be private or deleted.";
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

// --- Scrape Creators — transcript extraction (TikTok, Instagram Reels, YouTube)
// Each platform needs two calls: one for the transcript text/cues, one for
// video metadata (title/cover/duration/playable URL). See
// https://docs.scrapecreators.com if calls start failing with unexpected shapes.

const SCRAPECREATORS_BASE_URL = "https://api.scrapecreators.com";

export async function scrapeCreatorsGet<T>(path: string, params: Record<string, string>): Promise<T> {
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
    // Never the video file itself (no-watermark or not): Verlab doesn't
    // hand out videos from other platforms. The reader links to the post.
    videoUrl: null,
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

// Despite the function name history ("Shorts"), the underlying ScrapeCreators
// endpoints (/v1/youtube/video, /v1/youtube/video/transcript) work identically
// for any youtube.com/watch?v=... video, long-form included — extractYoutubeVideoId
// below already parses both URL shapes. The old restriction to Shorts-only
// lived entirely in detectTranscriptPlatform()'s URL matching, not here.
async function scrapeCreatorsFetchYoutubeTranscript(url: string): Promise<TranscriptResult> {
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
    // See the TikTok note above: no direct video file.
    videoUrl: null,
    embedUrl: null,
    lines: [{ timestamp: "0:00", text }],
  };
}

// --- video-download-api.com (p.savenow.to) -- fetches the YouTube source of
// an AI clipping project, server-side only. Async job API: submit to
// /ajax/download.php, then poll /ajax/progress.php (progress is in
// thousandths, 1000 = done) until download_url appears. See
// https://video-download-api.com/api/docs.
//
// This is NOT a user-facing downloader -- that feature was removed
// (2026-11-26). The link this returns is only ever read by Verlab's own
// servers and render worker to cut and caption clips; it must never be sent
// to a browser or an MCP client.

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

// A terminal job with no download_url is ambiguous by itself — it can mean a
// genuinely dead video, but just as often means an anti-bot block, a
// transient scrape hiccup, or an unresolved short link on the provider's
// side. The provider's own `text` field (e.g. "Failed", "Video not found",
// "This video is private") is the only signal that distinguishes those, so
// only trust an explicit not-found/private/removed phrase before telling the
// user the video itself is gone — anything else (including no text at all)
// is treated as a retryable provider error instead of a false confirmation.
const NOT_FOUND_REASON_PATTERN = /not found|private|remov|delet|unavailable|no longer exists|restrict/i;

async function savenowPollForDownloadUrl(
  id: string,
  onProgress?: (percent: number) => void,
  { signal, stallMs, timeoutMs = SAVENOW_POLL_TIMEOUT_MS }: DownloadPollOptions = {}
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastState = "";
  let lastChange = Date.now();
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const response = await fetchWithRetry(`${SAVENOW_BASE_URL}/ajax/progress.php?id=${encodeURIComponent(id)}`, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
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
      const reason = data.text?.trim();
      if (reason && NOT_FOUND_REASON_PATTERN.test(reason)) {
        throw new VideoProviderError(
          "not_found",
          "That video couldn't be downloaded. It may be private, deleted, or unsupported."
        );
      }
      throw new VideoProviderError(
        "provider_error",
        reason ? `Video Download API job failed: ${reason}` : "Video Download API job failed with no download_url"
      );
    }
    if (data.progress !== undefined) {
      onProgress?.(Math.floor(data.progress / 10));
    }
    // Some jobs just stop moving (seen 2026-11-19: trimmed mp3s that sat for
    // the whole poll while the same stretch asked again took 40s).
    const state = `${data.progress ?? ""}|${data.text ?? ""}`;
    if (state !== lastState) {
      lastState = state;
      lastChange = Date.now();
    } else if (stallMs && Date.now() - lastChange > stallMs) {
      throw new VideoProviderError("provider_error", "download_stalled");
    }

    await new Promise((resolve) => setTimeout(resolve, SAVENOW_POLL_INTERVAL_MS));
  }
  throw new VideoProviderError("provider_error", "download_timed_out");
}

/**
 * A stretch of the video (whole seconds) for the provider to cut out itself.
 * Measured 2026-11-19: the result starts on the requested second (video
 * within 10ms, mp3 within 25ms) and arrives in a minute or two wherever it
 * sits in the video, where the untrimmed stream can't seek and has to be
 * read from 0:00 (a clip an hour in was 40+ minutes of reading). Video
 * comes back re-encoded as a fragmented MP4 starting at 0; audio as a
 * finished file with a Content-Length. The provider caches a finished job
 * per request, so asking again for the same range returns the same link.
 */
export interface DownloadRange {
  start: number;
  end: number;
}

export interface DownloadPollOptions {
  /** Stops waiting for the job (it keeps running at the provider). */
  signal?: AbortSignal;
  /** Gives up on a job whose progress hasn't moved for this long. */
  stallMs?: number;
  /** Gives up on a job that isn't done after this long (default 3 minutes). */
  timeoutMs?: number;
}

export interface DownloadLinkOptions extends DownloadPollOptions {
  /** Just this stretch of the video, cut by the provider (YouTube and Facebook only). */
  range?: DownloadRange;
}

async function savenowSubmitAndPoll(
  url: string,
  format: ClipSourceFormat,
  apiKey: string,
  onProgress?: (percent: number) => void,
  { range, ...poll }: DownloadLinkOptions = {}
): Promise<DownloadResult> {
  const endpoint = new URL("/ajax/download.php", SAVENOW_BASE_URL);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("format", format);
  endpoint.searchParams.set("apikey", apiKey);
  endpoint.searchParams.set("add_info", "1");
  if (range) {
    endpoint.searchParams.set("start_time", String(Math.max(0, Math.floor(range.start))));
    endpoint.searchParams.set("end_time", String(Math.ceil(range.end)));
  }

  const response = await fetchWithRetry(endpoint, {
    signal: poll.signal ? AbortSignal.any([poll.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
  });
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

  const directUrl = await savenowPollForDownloadUrl(data.id, onProgress, poll);
  return { title: data.info?.title?.trim() || "Untitled video", directUrl };
}

const SAVENOW_JOB_ATTEMPTS = 2;
const SAVENOW_JOB_RETRY_DELAY_MS = 1_500;

async function savenowFetchDownloadLink(
  url: string,
  format: ClipSourceFormat,
  onProgress?: (percent: number) => void,
  options?: DownloadLinkOptions
): Promise<DownloadResult> {
  const apiKey = process.env.SAVENOW_API_KEY;
  if (!apiKey) {
    throw new VideoProviderError("not_configured", "Missing SAVENOW_API_KEY");
  }

  for (let attempt = 1; attempt <= SAVENOW_JOB_ATTEMPTS; attempt++) {
    try {
      return await savenowSubmitAndPoll(url, format, apiKey, onProgress, options);
    } catch (error) {
      const isAmbiguousFailure =
        error instanceof VideoProviderError &&
        error.code === "provider_error" &&
        error.message !== "download_timed_out" &&
        error.message !== "download_stalled" &&
        !options?.signal?.aborted;
      // Only retry the whole job for ambiguous, likely-transient provider
      // failures (anti-bot block, scrape hiccup, missing job id) — a
      // confirmed not_found, rate limit, misconfiguration, or a poll that
      // already ran the full timeout won't succeed on a second attempt.
      if (!isAmbiguousFailure || attempt === SAVENOW_JOB_ATTEMPTS) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, SAVENOW_JOB_RETRY_DELAY_MS));
    }
  }
  throw new VideoProviderError("provider_error", "Video Download API did not return a job id");
}


/** Whether a link is a YouTube video -- the only source AI clipping fetches. */
function isYoutubeUrl(rawUrl: string): boolean {
  return /(youtube\.com|youtu\.be)/i.test(rawUrl.trim());
}

export async function fetchTranscript(url: string): Promise<TranscriptResult> {
  const platform = detectTranscriptPlatform(url);
  switch (platform) {
    case "tiktok":
      return scrapeCreatorsFetchTikTokTranscript(url);
    case "shorts":
      return scrapeCreatorsFetchYoutubeTranscript(url);
    case "reels":
      return scrapeCreatorsFetchInstagramTranscript(url);
    default:
      throw new VideoProviderError("unsupported_url", "Unsupported video URL");
  }
}

/**
 * The direct media link for a YouTube video's source, for AI clipping's
 * server-side cutting and transcription only (see the note on the savenow
 * section above). Throws for anything that isn't YouTube.
 */
export async function fetchDownloadLink(
  url: string,
  format: ClipSourceFormat,
  onProgress?: (percent: number) => void,
  options?: DownloadLinkOptions
): Promise<DownloadResult> {
  if (!isYoutubeUrl(url)) {
    throw new VideoProviderError("unsupported_url", "Only YouTube videos can be clipped");
  }
  return savenowFetchDownloadLink(url, format, onProgress, options);
}

export { humanizeVideoProviderError };
