import type { ComponentType } from "react";
import { FacebookIcon, TikTokIcon, YouTubeIcon } from "@/components/landing/PlatformIcons";
import { cn } from "@/lib/utils";

export type DownloadPlatform = "youtube" | "tiktok" | "facebook";

export const DOWNLOAD_PLATFORMS: Record<
  DownloadPlatform,
  { label: string; icon: ComponentType<{ className?: string }> }
> = {
  youtube: { label: "YouTube", icon: YouTubeIcon },
  tiktok: { label: "TikTok", icon: TikTokIcon },
  facebook: { label: "Facebook", icon: FacebookIcon },
};

export const DOWNLOAD_PLATFORM_ORDER: DownloadPlatform[] = ["youtube", "tiktok", "facebook"];

// TikTok's note is black; on dark surfaces it takes the white of TikTok's own app icon.
const TIKTOK_ON_DARK = "dark:[&>g>path:last-child]:fill-white";

export function DownloadPlatformMark({ platform, className }: { platform: DownloadPlatform; className?: string }) {
  const Icon = DOWNLOAD_PLATFORMS[platform].icon;
  return <Icon className={cn(className, platform === "tiktok" && TIKTOK_ON_DARK)} />;
}
