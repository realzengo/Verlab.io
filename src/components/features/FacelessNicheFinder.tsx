"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { TrendingVideosGrid, type TrendingVideo } from "@/components/features/TrendingVideosGrid";
import { EMPTY_REFINE_FILTERS, RefineResultsPopover, type RefineFilters } from "@/components/features/RefineResultsPopover";
import { cn } from "@/lib/utils";
import type { NicheBendPlatform, NicheChannel, TrendingFeedVideo } from "@/lib/types";

// How many more real video cards reveal per scroll-triggered/"Load More"
// batch -- this bounds how much DOM grows per step, not how many videos
// exist; the feed keeps growing for as long as there's real data left.
const VIDEOS_PER_BATCH = 30;
type Timeframe = "7d" | "30d";

interface Filters {
  platform: NicheBendPlatform | "all";
}

/** Extends the display-only TrendingVideo with the raw real signals the
 * Refine Results popover (and the timeframe pill) filter on -- kept separate
 * from TrendingVideo itself so TrendingVideosGrid stays purely presentational. */
interface DerivedVideo extends TrendingVideo {
  rawViewCount: number;
  rawFollowerCount: number;
  rawPostedAt: string;
}

function SegmentedControl({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1 rounded-lg border border-hairline bg-app p-1">{children}</div>;
}

function SegmentPill({
  active,
  variant = "neutral",
  onClick,
  children,
}: {
  active: boolean;
  variant?: "neutral" | "success";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
        !active && "text-subtle hover:text-body",
        active && variant === "neutral" && "bg-ink text-white shadow-card",
        active && variant === "success" && "bg-success text-white shadow-card"
      )}
    >
      {children}
    </button>
  );
}

function withinTimeframe(iso: string, days: number): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t >= cutoff;
}

function timeAgoLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  if (days < 1) return "Today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Flattens real per-video data out of verified channels' recent_videos --
 * only videos with a real coverUrl and postedAt (currently populated by the
 * SociaVault TikTok and YouTube search.list discovery paths) qualify.
 * Channels ingested via the single-URL Apify/ScrapeCreators path only have a
 * video title, no thumbnail, so they don't contribute cards here -- there's
 * no fallback thumbnail/mock card standing in for them.
 */
function deriveTrendingVideos(channels: NicheChannel[]): DerivedVideo[] {
  const videos: DerivedVideo[] = [];

  for (const channel of channels) {
    for (const video of channel.recentVideos) {
      if (!video.coverUrl || !video.postedAt) continue;
      videos.push({
        id: video.videoUrl ?? `${channel.id}-${video.title}`,
        thumbnailUrl: video.coverUrl,
        category: channel.niche ?? channel.facelessCategory ?? "Faceless",
        platform: channel.platform,
        timeAgo: timeAgoLabel(video.postedAt),
        viewsCount: video.viewsCount ?? "N/A",
        likesCount: video.likesCount ?? "N/A",
        videoUrl: video.videoUrl,
        rawViewCount: video.viewCount ?? 0,
        rawFollowerCount: channel.subscriberCount,
        rawPostedAt: video.postedAt,
      });
    }
  }

  return videos.sort((a, b) => b.rawViewCount - a.rawViewCount);
}

/** Walks every page of `/api/niches/faceless` (the query module caps each
 * response at 60 rows) so the feed reflects *all* verified YouTube channels,
 * not just the first page -- calls `onPage` after each page so the grid can
 * fill in progressively instead of blocking on the full walk. TikTok no
 * longer sources from here; see fetchLiveTikTokFeed below. */
async function fetchAllYoutubeChannels(
  signal: AbortSignal,
  onPage: (accumulated: NicheChannel[]) => void
): Promise<void> {
  const channels: NicheChannel[] = [];
  let page = 1;

  for (;;) {
    const params = new URLSearchParams({ sort: "trending", pageSize: "60", page: String(page), platform: "youtube" });

    const response = await fetch(`/api/niches/faceless?${params.toString()}`, { signal });
    if (!response.ok) throw new Error(`Failed to load trending channels (${response.status})`);
    const json: { channels: NicheChannel[]; pagination: { hasMore: boolean } } = await response.json();

    channels.push(...json.channels);
    onPage([...channels]);

    if (!json.pagination.hasMore) break;
    page += 1;
  }
}

/** Fetches TikTok's real, unfiltered trending feed from
 * /api/niches/trending-feed (backed by fetchTikTokTrendingFeed in
 * sociavault-client.ts) -- a single call, not paginated like the channel
 * walk above, since the provider returns one region-scoped batch per
 * request. Skips items missing a thumbnail or post date, same rule
 * deriveTrendingVideos applies to channel-sourced videos. */
async function fetchLiveTikTokFeed(signal: AbortSignal): Promise<DerivedVideo[]> {
  const response = await fetch("/api/niches/trending-feed", { signal });
  if (!response.ok) throw new Error(`Failed to load live TikTok trending feed (${response.status})`);
  const json: { videos: TrendingFeedVideo[] } = await response.json();

  const videos: DerivedVideo[] = [];
  for (const item of json.videos) {
    if (!item.thumbnailUrl || !item.postedAt) continue;
    videos.push({
      id: item.id,
      thumbnailUrl: item.thumbnailUrl,
      category: item.category,
      platform: item.platform,
      timeAgo: timeAgoLabel(item.postedAt),
      viewsCount: item.viewsCount,
      likesCount: item.likesCount,
      videoUrl: item.videoUrl,
      rawViewCount: item.viewCount,
      rawFollowerCount: item.followerCount,
      rawPostedAt: item.postedAt,
    });
  }
  return videos;
}

function applyRefineFilters(videos: DerivedVideo[], filters: RefineFilters): DerivedVideo[] {
  const viewsMin = filters.viewsMin ? Number(filters.viewsMin) : null;
  const viewsMax = filters.viewsMax ? Number(filters.viewsMax) : null;
  const followersMin = filters.followersMin ? Number(filters.followersMin) : null;
  const followersMax = filters.followersMax ? Number(filters.followersMax) : null;
  const postedAfter = filters.postedAfter ? new Date(filters.postedAfter).getTime() : null;
  const postedBefore = filters.postedBefore ? new Date(filters.postedBefore).getTime() : null;

  return videos.filter((video) => {
    if (viewsMin != null && video.rawViewCount < viewsMin) return false;
    if (viewsMax != null && video.rawViewCount > viewsMax) return false;
    if (followersMin != null && video.rawFollowerCount < followersMin) return false;
    if (followersMax != null && video.rawFollowerCount > followersMax) return false;
    const postedTime = new Date(video.rawPostedAt).getTime();
    if (postedAfter != null && postedTime < postedAfter) return false;
    if (postedBefore != null && postedTime > postedBefore) return false;
    return true;
  });
}

export function FacelessNicheFinder() {
  const [filters, setFilters] = useState<Filters>({ platform: "all" });
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [refineFilters, setRefineFilters] = useState<RefineFilters>(EMPTY_REFINE_FILTERS);
  const [visibleVideoCount, setVisibleVideoCount] = useState(VIDEOS_PER_BATCH);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // YouTube still comes from verified niche_channels rows; TikTok now comes
  // entirely from the live trending feed below, so the channel walk is
  // skipped outright when only TikTok is being shown -- no point fetching
  // YouTube channels the grid won't display.
  const needsYoutubeChannels = filters.platform !== "tiktok";
  const needsLiveTikTokFeed = filters.platform !== "youtube";

  const [channels, setChannels] = useState<NicheChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(needsYoutubeChannels);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  const [liveTikTokVideos, setLiveTikTokVideos] = useState<DerivedVideo[]>([]);
  const [liveFeedLoading, setLiveFeedLoading] = useState(needsLiveTikTokFeed);
  const [liveFeedError, setLiveFeedError] = useState<string | null>(null);

  useEffect(() => {
    if (!needsYoutubeChannels) {
      setChannels([]);
      setChannelsLoading(false);
      setChannelsError(null);
      return;
    }

    const controller = new AbortController();
    setChannelsLoading(true);
    setChannelsError(null);
    setChannels([]);

    fetchAllYoutubeChannels(controller.signal, setChannels)
      .catch((error) => {
        if (controller.signal.aborted) return;
        setChannelsError(error instanceof Error ? error.message : "Failed to load trending channels");
      })
      .finally(() => {
        if (!controller.signal.aborted) setChannelsLoading(false);
      });

    return () => controller.abort();
  }, [needsYoutubeChannels]);

  useEffect(() => {
    if (!needsLiveTikTokFeed) {
      setLiveTikTokVideos([]);
      setLiveFeedLoading(false);
      setLiveFeedError(null);
      return;
    }

    const controller = new AbortController();
    setLiveFeedLoading(true);
    setLiveFeedError(null);

    fetchLiveTikTokFeed(controller.signal)
      .then((videos) => {
        if (!controller.signal.aborted) setLiveTikTokVideos(videos);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLiveFeedError(error instanceof Error ? error.message : "Failed to load the live TikTok trending feed");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLiveFeedLoading(false);
      });

    return () => controller.abort();
  }, [needsLiveTikTokFeed]);

  const timeframeDays = timeframe === "7d" ? 7 : 30;
  const allTrendingVideos = useMemo(() => {
    const youtubeVideos = needsYoutubeChannels ? deriveTrendingVideos(channels) : [];
    const tiktokVideos = needsLiveTikTokFeed ? liveTikTokVideos : [];
    return [...youtubeVideos, ...tiktokVideos].sort((a, b) => b.rawViewCount - a.rawViewCount);
  }, [channels, needsYoutubeChannels, liveTikTokVideos, needsLiveTikTokFeed]);
  // Real filter on each video's actual postedAt. TikTok now sources from the
  // live trending feed (fetchLiveTikTokFeed), which is genuinely recent, so
  // this should have plenty to show even at 7d; the all-time fallback below
  // exists mainly for YouTube, where verified channels' recent_videos can
  // still be sparse.
  const timeframeFilteredVideos = useMemo(
    () => allTrendingVideos.filter((video) => withinTimeframe(video.rawPostedAt, timeframeDays)),
    [allTrendingVideos, timeframeDays]
  );
  const withinTimeframeVideos = useMemo(
    () => applyRefineFilters(timeframeFilteredVideos, refineFilters),
    [timeframeFilteredVideos, refineFilters]
  );
  const allTimeVideos = useMemo(
    () => applyRefineFilters(allTrendingVideos, refineFilters),
    [allTrendingVideos, refineFilters]
  );
  // Never show a fabricated fallback -- if the strict timeframe window is
  // empty, fall back to real videos outside that window (still real
  // channels, still respecting platform + Refine filters) rather than an
  // invented placeholder array, and say so honestly instead of pretending
  // it's still date-scoped.
  const usingAllTimeFallback = withinTimeframeVideos.length === 0 && allTimeVideos.length > 0;
  const trendingVideos = usingAllTimeFallback ? allTimeVideos : withinTimeframeVideos;

  // Clamped directly during render rather than synced back via an effect --
  // if a filter change shrinks the result set below what was already
  // revealed, this just falls back to showing everything left instead of
  // rendering past the end of the real array. Never clamped *up* past
  // VIDEOS_PER_BATCH, so a fresh filter always starts at one full batch.
  const safeVisibleVideoCount = Math.min(Math.max(visibleVideoCount, VIDEOS_PER_BATCH), trendingVideos.length);
  const pagedVideos = useMemo(() => trendingVideos.slice(0, safeVisibleVideoCount), [trendingVideos, safeVisibleVideoCount]);
  const hasMoreVideos = safeVisibleVideoCount < trendingVideos.length;

  // Auto-load the next batch when the sentinel scrolls into view; the
  // "Load More" button below is the manual/no-JS-observer fallback for the
  // same action. Re-observes whenever hasMoreVideos flips so it keeps
  // working across multiple batches instead of firing once and going stale.
  useEffect(() => {
    if (!hasMoreVideos) return;
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleVideoCount((count) => count + VIDEOS_PER_BATCH);
      },
      { rootMargin: "600px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreVideos]);

  const platformLabel = filters.platform === "all" ? "All Platforms" : filters.platform === "tiktok" ? "TikTok" : "YouTube";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-heading">Top Trending Videos</h1>
          <p className="text-xs text-subtle">Across all niches · {platformLabel} · Sorted by views</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl>
            <SegmentPill active={filters.platform === "all"} onClick={() => setFilters({ platform: "all" })}>
              All
            </SegmentPill>
            <SegmentPill active={filters.platform === "tiktok"} onClick={() => setFilters({ platform: "tiktok" })}>
              TikTok
            </SegmentPill>
            <SegmentPill active={filters.platform === "youtube"} onClick={() => setFilters({ platform: "youtube" })}>
              YouTube
            </SegmentPill>
          </SegmentedControl>
          <SegmentedControl>
            <SegmentPill variant="success" active={timeframe === "7d"} onClick={() => setTimeframe("7d")}>
              7d
            </SegmentPill>
            <SegmentPill variant="success" active={timeframe === "30d"} onClick={() => setTimeframe("30d")}>
              30d
            </SegmentPill>
          </SegmentedControl>
          <RefineResultsPopover applied={refineFilters} onApply={setRefineFilters} />
        </div>
      </div>

      {trendingVideos.length === 0 && (channelsError || liveFeedError) ? (
        <p className="text-xs text-red-500">{channelsError || liveFeedError}</p>
      ) : (channelsLoading || liveFeedLoading) && trendingVideos.length === 0 ? (
        <p className="text-xs text-subtle">Loading trending videos…</p>
      ) : trendingVideos.length === 0 ? (
        <p className="text-xs text-subtle">
          No videos posted in the selected window yet -- try 30d, or run the TikTok/YouTube trend sync from the admin
          dashboard to pull in fresher real videos.
        </p>
      ) : (
        <>
          {/* One source failing (e.g. TikTok's live feed down) shouldn't hide
              results the other source did return -- surface it as a note
              instead of blanking the grid. */}
          {(channelsError || liveFeedError) && (
            <p className="text-xs text-red-500">{channelsError || liveFeedError}, showing partial results.</p>
          )}
          {usingAllTimeFallback && (
            <p className="text-xs text-subtle">
              No videos posted in the last {timeframeDays}d -- showing all-time top videos instead.
            </p>
          )}
          <TrendingVideosGrid videos={pagedVideos} />
          {hasMoreVideos && (
            <div ref={loadMoreRef} className="mb-16 mt-10 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleVideoCount((count) => count + VIDEOS_PER_BATCH)}
                className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-5 py-2 text-sm font-medium text-body transition-colors hover:bg-app"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-subtle" aria-hidden />
                Load more ({trendingVideos.length - pagedVideos.length} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
