// Shared (client + server) shapes and helpers for the Clipping tool.

export type ClipProjectStatus = "queued" | "transcribing" | "finding" | "ready" | "failed";

/** One word with its timing, seconds on the source timeline: [start, end, word]. */
export type TranscriptWord = [number, number, string];

/** How a moment scores on the four things that make a short hold attention, 0-100 each. */
export interface ClipScoreBreakdown {
  hook: number;
  flow: number;
  value: number;
  trend: number;
}

/** An emoji the captions pop in when `word` is spoken. */
export interface ClipEmoji {
  word: string;
  emoji: string;
}

/** A detected viral moment inside the source video. */
export interface ClipMoment {
  id: string;
  /** Seconds on the source timeline. */
  start: number;
  end: number;
  title: string;
  /** A 3-8 word headline shown over the first seconds of the clip. */
  hookTitle: string;
  hook: string;
  /** 0-100, how likely the moment is to hold attention on its own. */
  score: number;
  scores: ClipScoreBreakdown;
  reason: string;
  /** Words worth emphasising in the captions. */
  keywords: string[];
  emojis: ClipEmoji[];
  /** Ready-to-post caption, without hashtags. */
  caption: string;
  hashtags: string[];
}

export type ClipLengthPreference = "auto" | "short" | "medium" | "long";

export const CLIP_LENGTHS: { value: ClipLengthPreference; label: string; range: [number, number] }[] = [
  { value: "auto", label: "Auto", range: [20, 75] },
  { value: "short", label: "Under 30s", range: [12, 30] },
  { value: "medium", label: "30–60s", range: [30, 60] },
  { value: "long", label: "60–90s", range: [60, 90] },
];

/** What the user asked for when starting a project. */
export interface ClipOptions {
  length: ClipLengthPreference;
  /** Optional: what to look for ("the funniest moments", "anything about money"). */
  focus: string;
}

export const CLIP_FOCUS_MAX = 200;

export const DEFAULT_CLIP_OPTIONS: ClipOptions = { length: "auto", focus: "" };

export function normalizeClipOptions(raw: unknown): ClipOptions {
  const input = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ClipOptions, unknown>>;
  const length = CLIP_LENGTHS.some((option) => option.value === input.length)
    ? (input.length as ClipLengthPreference)
    : "auto";
  const focus =
    typeof input.focus === "string"
      ? input.focus
          .replace(/[\u0000-\u001f<>]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, CLIP_FOCUS_MAX)
      : "";
  return { length, focus };
}

export interface ClipProject {
  id: string;
  sourceUrl: string;
  videoId: string;
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number;
  status: ClipProjectStatus;
  options: ClipOptions;
  clips: ClipMoment[] | null;
  /** Only on the single-project response, once ready. */
  transcript?: TranscriptWord[] | null;
  errorMessage: string | null;
  createdAt: string;
}

export type ClipAspect = "9:16" | "1:1" | "16:9";

/** A finished clip saved to the user's library. */
export interface ClipExport {
  id: string;
  projectId: string;
  clipId: string;
  title: string;
  aspect: ClipAspect;
  durationSeconds: number;
  sizeBytes: number;
  url: string;
  /** Same file, served as an attachment named after the title. */
  downloadUrl: string;
  createdAt: string;
}

/** Most the bucket (and Supabase's project-wide cap) accepts. */
export const CLIP_EXPORT_MAX_BYTES = 50 * 1024 * 1024;

/** A long-form YouTube video offered in the "Or choose" grid or the link preview. */
export interface ClipSourceVideo {
  id: string;
  title: string;
  channelTitle: string;
  channelAvatarUrl: string | null;
  thumbnailUrl: string;
  durationSeconds: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
}

export const CLIP_SOURCE_MIN_SECONDS = 2 * 60;
export const CLIP_SOURCE_MAX_SECONDS = 3 * 60 * 60;
/** Longest single clip the editor will cut. */
export const CLIP_MAX_SECONDS = 180;

export const DISCOVER_CATEGORIES = [
  { id: "recommended", label: "Recommended" },
  { id: "podcasts", label: "Podcasts" },
  { id: "entertainment", label: "Entertainment" },
  { id: "sports", label: "Sports" },
  { id: "gaming", label: "Gaming" },
  { id: "news", label: "News" },
] as const;

export type DiscoverCategory = (typeof DISCOVER_CATEGORIES)[number]["id"];

export function isDiscoverCategory(value: string): value is DiscoverCategory {
  return DISCOVER_CATEGORIES.some((category) => category.id === value);
}

const YOUTUBE_ID = /^[\w-]{11}$/;

/** The 11-character video id from any youtube.com / youtu.be watch, shorts, live or embed link. */
export function parseYoutubeVideoId(rawUrl: string): string | null {
  const input = rawUrl.trim();
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v");
    if (!id) {
      const match = url.pathname.match(/^\/(?:shorts|live|embed|v)\/([\w-]{11})/);
      id = match?.[1] ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export const youtubeWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

/** "0m29", "12m05", "1h02m" -- the clip strip's compact label. */
export function formatClipOffset(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}m`;
  return `${m}m${s.toString().padStart(2, "0")}`;
}

/** "00:29", "1:02:05". */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatCompactNumber(value: number | null): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function isClipProjectWorking(status: ClipProjectStatus): boolean {
  return status === "queued" || status === "transcribing" || status === "finding";
}
