"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  GenericPageSkeleton,
  HomeSkeleton,
  LibraryItemSkeleton,
  LibrarySkeleton,
  McpSkeleton,
  NichesSkeleton,
  ToolsSkeleton,
} from "@/components/skeletons/DashboardSkeletons";
import {
  AccountSettingsSkeleton,
  ConnectedAppsSettingsSkeleton,
  CreditsSettingsSkeleton,
  SecuritySettingsSkeleton,
  SettingsShellSkeleton,
  SubscriptionSettingsSkeleton,
} from "@/components/skeletons/SettingsSkeletons";
import {
  BendSkeleton,
  ClippingSkeleton,
  DownloaderSkeleton,
  ImageGeneratorSkeleton,
  ScriptsSkeleton,
  TranscriptsSkeleton,
  VideoGeneratorSkeleton,
  VoiceoverSkeleton,
} from "@/components/skeletons/ToolSkeletons";

// Keyed by the clean URL the browser shows (proxy.ts rewrites /library to
// /app/library), which is what usePathname() returns.
const PAGE_SKELETONS: Record<string, ReactNode> = {
  "/": <HomeSkeleton />,
  "/niches": <NichesSkeleton />,
  "/tools": <ToolsSkeleton />,
  "/library": <LibrarySkeleton />,
  "/mcp": <McpSkeleton />,
  "/bend": <BendSkeleton />,
  "/downloads": <DownloaderSkeleton />,
  "/image-generator": <ImageGeneratorSkeleton />,
  "/video-generator": <VideoGeneratorSkeleton />,
  "/voiceover-generator": <VoiceoverSkeleton />,
  "/scripts": <ScriptsSkeleton />,
  "/transcripts": <TranscriptsSkeleton />,
  "/clipping": <ClippingSkeleton />,
};

const SETTINGS_SKELETONS: Record<string, ReactNode> = {
  "/settings": <AccountSettingsSkeleton />,
  "/settings/subscription": <SubscriptionSettingsSkeleton />,
  "/settings/credits": <CreditsSettingsSkeleton />,
  "/settings/security": <SecuritySettingsSkeleton />,
  "/settings/mcp": <ConnectedAppsSettingsSkeleton />,
};

/** Loading screen for the top-level /app boundary. That one boundary covers
 * every dashboard route that doesn't have its own loading.tsx (and any
 * navigation that crosses from settings into the tools or back), so it picks
 * the skeleton matching the route being navigated to -- the router has
 * already committed the new URL by the time this fallback renders. */
export function RouteSkeleton() {
  const rawPathname = usePathname() ?? "/";
  // Tolerate the old-style /app prefix too, in case a request reaches the
  // page without the clean-URL rewrite (e.g. local dev on the bare host).
  const pathname =
    rawPathname === "/app" ? "/" : rawPathname.startsWith("/app/") ? rawPathname.slice("/app".length) : rawPathname;

  const settingsSkeleton = SETTINGS_SKELETONS[pathname];
  if (settingsSkeleton) return <SettingsShellSkeleton>{settingsSkeleton}</SettingsShellSkeleton>;

  if (pathname.startsWith("/library/")) return <LibraryItemSkeleton />;

  return PAGE_SKELETONS[pathname] ?? <GenericPageSkeleton />;
}
