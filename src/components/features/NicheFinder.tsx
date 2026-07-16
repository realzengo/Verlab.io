"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Heart,
  MessageCircle,
  Minus,
  Play,
  Search,
  Share2,
  TrendingDown,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  EMPTY_VIDEO_RANGE_FILTERS,
  VideoFilterBar,
  type VideoPlatformFilter,
  type VideoRangeFilters,
  type VideoTimeWindow,
} from "@/components/features/VideoFilterBar";
import { cn } from "@/lib/utils";
import type { Niche, TrendingVideo } from "@/lib/types";

type NicheFinderPlatform = "all" | "tiktok" | "youtube" | "instagram";
type ContentStyle = "all" | "narrated" | "ai-generated" | "2d-animation";

const TOP_NICHES_LIMIT = 6;

const PLATFORM_OPTIONS: { id: NicheFinderPlatform; label: string }[] = [
  { id: "all", label: "All platforms" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "instagram", label: "Instagram" },
];

const STYLE_OPTIONS: { id: ContentStyle; label: string }[] = [
  { id: "all", label: "All styles" },
  { id: "narrated", label: "Narrated" },
  { id: "ai-generated", label: "AI-Generated" },
  { id: "2d-animation", label: "2D Animation" },
];

const STYLE_LABEL: Record<Exclude<ContentStyle, "all">, string> = {
  narrated: "Narrated",
  "ai-generated": "AI-Generated",
  "2d-animation": "2D Animation",
};

// The niche-discovery prompt tags every niche with one of these three
// production styles; older seed rows predating that prompt fall back to
// "narrated" since that's the most common style among them.
function nicheStyle(niche: Niche): Exclude<ContentStyle, "all"> {
  const tags = niche.tags.map((tag) => tag.toLowerCase());
  if (tags.some((tag) => tag.includes("ai"))) return "ai-generated";
  if (tags.some((tag) => tag.includes("2d") || tag.includes("animat"))) return "2d-animation";
  return "narrated";
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };
const TREND_BADGE_VARIANT = { up: "success", down: "danger", flat: "default" } as const;
const TREND_LABEL = { up: "Rising", down: "Cooling down", flat: "Steady" };

const CARD_GRADIENTS = [
  "from-indigo-400 to-purple-500",
  "from-blue-400 to-cyan-500",
  "from-rose-400 to-orange-400",
  "from-emerald-400 to-teal-500",
  "from-fuchsia-400 to-pink-500",
  "from-amber-400 to-red-400",
  "from-sky-400 to-indigo-500",
  "from-lime-400 to-emerald-500",
];

function gradientForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
}

function formatCompactNumber(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}

function formatTimeAgo(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const posted = new Date(isoDate).getTime();
  if (Number.isNaN(posted)) return null;
  const diffMs = Date.now() - posted;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) return `${Math.max(diffMinutes, 1)}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function isWithinRecentWindow(postedTimeMs: number, windowDays: number): boolean {
  return Date.now() - postedTimeMs <= windowDays * 24 * 60 * 60 * 1000;
}

const VIDEOS_PER_PAGE = 24;

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const items = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  return (
    <nav aria-label="Trending videos pagination" className="mt-6 flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="flex h-8 items-center gap-1 rounded-full border border-hairline bg-surface px-3 text-xs font-semibold text-body transition-colors hover:text-heading disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Prev
      </button>

      {items.map((p, index) => {
        const prev = items[index - 1];
        const showEllipsis = prev !== undefined && p - prev > 1;
        return (
          <span key={p} className="flex items-center gap-1.5">
            {showEllipsis && <span className="px-1 text-xs text-body">…</span>}
            <button
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-semibold transition-colors",
                p === page
                  ? "bg-primary text-white"
                  : "border border-hairline bg-surface text-body hover:text-heading"
              )}
            >
              {p}
            </button>
          </span>
        );
      })}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className="flex h-8 items-center gap-1 rounded-full border border-hairline bg-surface px-3 text-xs font-semibold text-body transition-colors hover:text-heading disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}

function initialsFor(name: string): string {
  const cleaned = name.replace(/^@/, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase() || "??";
}

function ToggleGroup<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex flex-wrap items-center gap-1 rounded-full bg-app p-1">
      {options.map((option) => {
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-[background-color,box-shadow] sm:px-4 sm:text-sm",
              isActive ? "bg-surface text-heading shadow-card" : "text-body hover:text-heading"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function NicheScoreCard({ niche, rank }: { niche: Niche; rank: number }) {
  const TrendIcon = TREND_ICON[niche.momentumTrend];
  const topVideo = niche.sampleVideos[0];

  return (
    <div className="flex flex-col rounded-card-lg border border-hairline bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
              #{rank}
            </span>
            <h3 className="text-lg font-bold leading-snug text-heading">{niche.name}</h3>
          </div>
          <p className="mt-1 text-xs text-body">
            {niche.category} · {STYLE_LABEL[nicheStyle(niche)]}
          </p>
        </div>
        <Badge variant={TREND_BADGE_VARIANT[niche.momentumTrend]} className="shrink-0">
          <TrendIcon className="h-3 w-3" />
          {TREND_LABEL[niche.momentumTrend]}
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-accent-line bg-accent p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Clypa Score</p>
          <p className="mt-1 text-3xl font-extrabold text-heading">{niche.momentumScore}</p>
        </div>

        {niche.tags.length > 0 && (
          <div className="flex flex-1 flex-wrap gap-1.5">
            {niche.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-app px-2 py-1 text-[11px] font-medium text-body">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {topVideo && (
        <div className="mt-4 rounded-xl border border-hairline bg-app p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-body">Top sample video</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-heading">{topVideo.title}</p>
          <p className="mt-1 text-[11px] font-semibold text-primary">{topVideo.views} views</p>
        </div>
      )}

      <Link
        href="/app/bend"
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] hover:-translate-y-px hover:bg-primary-hover sm:inline-flex sm:w-auto sm:self-start"
      >
        <Wand2 className="h-4 w-4" />
        Bend this niche
      </Link>
    </div>
  );
}

function TrendingVideoCard({ video }: { video: TrendingVideo }) {
  const [saved, setSaved] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const timeAgo = formatTimeAgo(video.postedAt);

  return (
    <div className="flex flex-col">
      <div className="group relative aspect-[9/16] w-full overflow-hidden rounded-card border border-hairline bg-ink">
        <div className={cn("absolute inset-0 bg-gradient-to-br", gradientForId(video.id))} />
        {video.coverUrl && !coverFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.coverUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setCoverFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/35" />

        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            TikTok
          </span>
          {video.hashtag && (
            <span className="rounded-md bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
              #{video.hashtag}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSaved((prev) => !prev)}
          aria-label="Save video"
          aria-pressed={saved}
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        >
          <Heart className={cn("h-3.5 w-3.5", saved && "fill-red-500 text-red-500")} />
        </button>

        <a
          href={video.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Watch "${video.title}" on TikTok`}
          className="absolute inset-0 flex items-center justify-center opacity-90 transition-opacity group-hover:opacity-100"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-card-hover">
            <Play className="h-4.5 w-4.5 fill-ink text-ink" />
          </div>
        </a>

        <div className="absolute bottom-2.5 left-2.5 right-11">
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.8)]">
            {video.title}
          </p>
          <p className="mt-1 text-[11px] font-medium text-white/85 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.8)]">
            {video.views} views
          </p>
        </div>

        <div className="absolute bottom-2.5 right-2.5 flex flex-col items-center gap-1.5">
          {video.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-7 w-7 shrink-0 rounded-full border-2 border-white object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-primary text-[10px] font-bold text-white">
              {initialsFor(video.author)}
            </div>
          )}
          <Link
            href="/app/bend"
            aria-label="Bend this script"
            title="Bend this script"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary shadow-card transition-colors hover:bg-accent"
          >
            <Wand2 className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-body">
        {timeAgo && <span className="shrink-0 font-medium">{timeAgo}</span>}
        <div className="flex flex-1 items-center justify-end gap-2.5">
          <span className="flex items-center gap-0.5" title="Views">
            <Eye className="h-3 w-3" />
            {video.views}
          </span>
          <span className="flex items-center gap-0.5" title="Likes">
            <Heart className="h-3 w-3" />
            {formatCompactNumber(video.likeCount)}
          </span>
          <span className="flex items-center gap-0.5" title="Comments">
            <MessageCircle className="h-3 w-3" />
            {formatCompactNumber(video.commentCount)}
          </span>
          <span className="flex items-center gap-0.5" title="Shares">
            <Share2 className="h-3 w-3" />
            {formatCompactNumber(video.shareCount)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function NicheFinder({ niches, trendingVideos }: { niches: Niche[]; trendingVideos: TrendingVideo[] }) {
  const [search, setSearch] = useState("");

  // Platform/style selections are staged until "Apply filters" is clicked,
  // so toggling an option doesn't refilter results out from under you.
  const [pendingPlatform, setPendingPlatform] = useState<NicheFinderPlatform>("all");
  const [pendingStyle, setPendingStyle] = useState<ContentStyle>("all");
  const [appliedPlatform, setAppliedPlatform] = useState<NicheFinderPlatform>("all");
  const [appliedStyle, setAppliedStyle] = useState<ContentStyle>("all");

  const hasPendingChanges = pendingPlatform !== appliedPlatform || pendingStyle !== appliedStyle;
  const hasActiveFilters = appliedPlatform !== "all" || appliedStyle !== "all";

  function applyFilters() {
    setAppliedPlatform(pendingPlatform);
    setAppliedStyle(pendingStyle);
  }

  function resetFilters() {
    setPendingPlatform("all");
    setPendingStyle("all");
    setAppliedPlatform("all");
    setAppliedStyle("all");
  }

  const filteredNiches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return niches
      .filter((niche) => appliedPlatform === "all" || niche.platform === appliedPlatform || niche.platform === "mixed")
      .filter((niche) => appliedStyle === "all" || nicheStyle(niche) === appliedStyle)
      .filter(
        (niche) =>
          !query || niche.name.toLowerCase().includes(query) || niche.category.toLowerCase().includes(query)
      )
      .slice(0, TOP_NICHES_LIMIT);
  }, [niches, search, appliedPlatform, appliedStyle]);

  // The video grid has its own filter bar (platform/posting-window/views/followers),
  // independent from the niche Platform+Style panel above.
  const [videoPlatform, setVideoPlatform] = useState<VideoPlatformFilter>("all");
  const [videoTimeWindow, setVideoTimeWindow] = useState<VideoTimeWindow>("all");
  const [videoRangeFilters, setVideoRangeFilters] = useState<VideoRangeFilters>(EMPTY_VIDEO_RANGE_FILTERS);

  const filteredVideos = useMemo(() => {
    // Live videos are TikTok-only right now (see fetchFacelessTrendingVideos).
    if (videoPlatform !== "all" && videoPlatform !== "tiktok") return [];

    const windowDays = videoTimeWindow === "7d" ? 7 : videoTimeWindow === "30d" ? 30 : null;
    const postedAfter = videoRangeFilters.postedAfter ? new Date(videoRangeFilters.postedAfter).getTime() : null;
    const postedBefore = videoRangeFilters.postedBefore ? new Date(videoRangeFilters.postedBefore).getTime() : null;
    const viewsMin = videoRangeFilters.viewsMin ? Number(videoRangeFilters.viewsMin) : null;
    const viewsMax = videoRangeFilters.viewsMax ? Number(videoRangeFilters.viewsMax) : null;
    const followersMin = videoRangeFilters.followersMin ? Number(videoRangeFilters.followersMin) : null;
    const followersMax = videoRangeFilters.followersMax ? Number(videoRangeFilters.followersMax) : null;

    return trendingVideos.filter((video) => {
      if (viewsMin !== null && video.viewCount < viewsMin) return false;
      if (viewsMax !== null && video.viewCount > viewsMax) return false;
      if (followersMin !== null && video.followerCount < followersMin) return false;
      if (followersMax !== null && video.followerCount > followersMax) return false;

      const postedTime = video.postedAt ? new Date(video.postedAt).getTime() : null;
      if (postedAfter !== null || postedBefore !== null) {
        if (postedTime === null) return false;
        if (postedAfter !== null && postedTime < postedAfter) return false;
        if (postedBefore !== null && postedTime > postedBefore) return false;
      } else if (windowDays !== null) {
        if (postedTime === null || !isWithinRecentWindow(postedTime, windowDays)) return false;
      }
      return true;
    });
  }, [trendingVideos, videoPlatform, videoTimeWindow, videoRangeFilters]);

  const [videoPage, setVideoPage] = useState(1);
  const totalVideoPages = Math.max(1, Math.ceil(filteredVideos.length / VIDEOS_PER_PAGE));

  // Reset to page 1 whenever the applied filters change. Adjusting state
  // during render (rather than in an effect) avoids an extra commit/render.
  const [videoFiltersKey, setVideoFiltersKey] = useState(
    `${videoPlatform}:${videoTimeWindow}:${JSON.stringify(videoRangeFilters)}`
  );
  const nextVideoFiltersKey = `${videoPlatform}:${videoTimeWindow}:${JSON.stringify(videoRangeFilters)}`;
  if (videoFiltersKey !== nextVideoFiltersKey) {
    setVideoFiltersKey(nextVideoFiltersKey);
    setVideoPage(1);
  }

  const pagedVideos = useMemo(() => {
    const start = (videoPage - 1) * VIDEOS_PER_PAGE;
    return filteredVideos.slice(start, start + VIDEOS_PER_PAGE);
  }, [filteredVideos, videoPage]);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-heading">Niche Finder</h2>
            <p className="mt-1 max-w-xl text-sm text-body">
              Discover explosive social media trends, reverse-engineer viral frameworks, and identify
              high-revenue gaps.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search niches or topics..."
                aria-label="Search niches or topics"
                className="w-full rounded-full border border-hairline bg-surface py-2.5 pl-9 pr-4 text-sm text-heading placeholder:text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <Button variant="secondary" size="md" icon={Download} className="shrink-0">
              Export
            </Button>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-hairline bg-surface p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Platform</span>
                <ToggleGroup ariaLabel="Platform" options={PLATFORM_OPTIONS} value={pendingPlatform} onChange={setPendingPlatform} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Content style</span>
                <ToggleGroup ariaLabel="Content style" options={STYLE_OPTIONS} value={pendingStyle} onChange={setPendingStyle} />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-hairline pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-body">
                {hasPendingChanges
                  ? "Filter changes not applied yet."
                  : hasActiveFilters
                    ? `Showing ${appliedPlatform === "all" ? "all platforms" : PLATFORM_OPTIONS.find((o) => o.id === appliedPlatform)?.label} · ${appliedStyle === "all" ? "all styles" : STYLE_LABEL[appliedStyle]}`
                    : "Showing all platforms and styles."}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={resetFilters} disabled={!hasActiveFilters && !hasPendingChanges}>
                  Reset
                </Button>
                <Button variant="primary" size="sm" onClick={applyFilters} disabled={!hasPendingChanges}>
                  Apply filters
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-heading">Trending Niches</h3>
          <a
            href="#all-niches"
            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline underline-offset-4"
          >
            See all trending niches
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {filteredNiches.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {filteredNiches.map((niche, index) => (
              <NicheScoreCard key={niche.id} niche={niche} rank={index + 1} />
            ))}
          </div>
        ) : niches.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-hairline bg-surface p-8 text-center text-sm text-body">
            Trending niches will appear here once the next refresh runs.
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-hairline bg-surface p-8 text-center text-sm text-body">
            No niches match the current filters{search ? ` and "${search}"` : ""}.
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-heading">Top Trending Videos</h2>
            <p className="mt-1 text-sm text-body">Live from TikTok&apos;s trending feed</p>
          </div>
          <VideoFilterBar
            platform={videoPlatform}
            onPlatformChange={setVideoPlatform}
            timeWindow={videoTimeWindow}
            onTimeWindowChange={setVideoTimeWindow}
            filters={videoRangeFilters}
            onApply={setVideoRangeFilters}
            onClear={() => setVideoRangeFilters(EMPTY_VIDEO_RANGE_FILTERS)}
          />
        </div>

        {filteredVideos.length > 0 && (
          <p className="mt-3 text-xs text-body">
            {filteredVideos.length} videos · page {videoPage} of {totalVideoPages}
          </p>
        )}

        {filteredVideos.length > 0 ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {pagedVideos.map((video) => (
                <TrendingVideoCard key={video.id} video={video} />
              ))}
            </div>
            <Pagination page={videoPage} totalPages={totalVideoPages} onChange={setVideoPage} />
          </>
        ) : trendingVideos.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-hairline bg-surface p-8 text-center text-sm text-body">
            Live trending videos will appear here once the next refresh runs.
          </div>
        ) : videoPlatform !== "all" && videoPlatform !== "tiktok" ? (
          <div className="mt-5 rounded-xl border border-dashed border-hairline bg-surface p-8 text-center text-sm text-body">
            Live video data for YouTube is coming soon — currently sourced from TikTok only.
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-hairline bg-surface p-8 text-center text-sm text-body">
            No live videos match the current filters.
          </div>
        )}
      </section>
    </div>
  );
}
