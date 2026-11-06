import type { ComponentType } from "react";
import type { TranscriptPlatform } from "@/lib/transcript-platform";
import { InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/landing/PlatformIcons";
import { cn } from "@/lib/utils";

// Named for the app, not the format: "shorts" covers every YouTube link and
// "reels" every Instagram one (see detectTranscriptPlatform).
export const TRANSCRIPT_PLATFORMS: Record<
  TranscriptPlatform,
  { label: string; icon: ComponentType<{ className?: string }> }
> = {
  tiktok: { label: "TikTok", icon: TikTokIcon },
  reels: { label: "Instagram", icon: InstagramIcon },
  shorts: { label: "YouTube", icon: YouTubeIcon },
};

export const TRANSCRIPT_PLATFORM_ORDER: TranscriptPlatform[] = ["shorts", "tiktok", "reels"];

// TikTok's note is black; on dark surfaces it takes the white of TikTok's own app icon.
const TIKTOK_ON_DARK = "dark:[&>g>path:last-child]:fill-white";

export function TranscriptPlatformMark({ platform, className }: { platform: TranscriptPlatform; className?: string }) {
  const Icon = TRANSCRIPT_PLATFORMS[platform].icon;
  return <Icon className={cn(className, platform === "tiktok" && TIKTOK_ON_DARK)} />;
}

/** "https://www.tiktok.com/@a/video/1" -> "tiktok.com/@a/video/1" */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.|m\.)?/i, "").replace(/\/$/, "");
}

/** 47 -> "0:47", 3725 -> "1:02:05" */
export function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = String(Math.floor(seconds % 60)).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}

/** "Nov 6, 3:12 PM" */
export function formatCreated(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const HASHTAG = /#[\p{L}\p{N}_]+/gu;

/**
 * A short-form caption split for display: the hashtags pulled out, and the
 * emoji a caption often opens with dropped from the heading.
 * "✈️ RED-EYE Part 4 #decide #story" -> { title: "RED-EYE Part 4", tags: ["#decide", "#story"] }
 */
export function splitCaption(raw: string): { title: string; tags: string[] } {
  const tags = Array.from(new Set(raw.match(HASHTAG) ?? []));
  const title = raw
    .replace(HASHTAG, "")
    .replace(/^[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\s]+/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { title: title || raw.trim(), tags };
}
