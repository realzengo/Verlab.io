"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Play,
  Share2,
  Users,
  Wand2,
} from "lucide-react";
import {
  EMPTY_VIDEO_RANGE_FILTERS,
  VideoFilterBar,
  type VideoPlatformFilter,
  type VideoRangeFilters,
  type VideoTimeWindow,
} from "@/components/features/VideoFilterBar";
import { useNicheSidebar, useNicheSidebarSync } from "@/components/dashboard/NicheSidebarContext";
import { cn } from "@/lib/utils";
import type { TrendingVideo } from "@/lib/types";

export const VIDEOS_PER_PAGE = 20;

type ContentStyle = "narrated" | "ai-generated" | "2d-animation";

const STYLE_LABEL: Record<ContentStyle, string> = {
  narrated: "Narrated",
  "ai-generated": "AI-Generated",
  "2d-animation": "2D Animation",
};

function videoStyle(video: TrendingVideo): ContentStyle {
  const tag = video.hashtag.toLowerCase();
  if (tag.includes("ai")) return "ai-generated";
  if (tag.includes("2d") || tag.includes("animat")) return "2d-animation";
  return "narrated";
}

// Categorical hue slots (1-8, dataviz-validated order) assigned once per
// niche/style so a given tag always renders the same color everywhere.
const NICHE_CAT_SLOT: Record<string, number> = {
  History: 1,
  Horror: 2,
  Crime: 3,
  Finance: 4,
  Education: 5,
  Storytelling: 6,
  Entertainment: 7,
  Animals: 8,
  Explained: 1,
  Engineering: 2,
  Military: 3,
  Sport: 4,
  Technology: 5,
  Psychology: 6,
  Religion: 7,
  "Crime & Psychology": 8,
  "Fitness & Health": 1,
  Politics: 2,
  Stats: 3,
  Gaming: 4,
  Games: 5,
};

const STYLE_CAT_SLOT: Record<ContentStyle, number> = {
  narrated: 5,
  "ai-generated": 7,
  "2d-animation": 6,
};

const CAT_CHIP: Record<number, string> = {
  1: "border-2 border-cat-1/20 bg-cat-1-tint text-cat-1",
  2: "border-2 border-cat-2/20 bg-cat-2-tint text-cat-2",
  3: "border-2 border-cat-3/20 bg-cat-3-tint text-cat-3",
  4: "border-2 border-cat-4/20 bg-cat-4-tint text-cat-4",
  5: "border-2 border-cat-5/20 bg-cat-5-tint text-cat-5",
  6: "border-2 border-cat-6/20 bg-cat-6-tint text-cat-6",
  7: "border-2 border-cat-7/20 bg-cat-7-tint text-cat-7",
  8: "border-2 border-cat-8/20 bg-cat-8-tint text-cat-8",
};

const CAT_CHIP_ACTIVE: Record<number, string> = {
  1: "border-2 border-cat-1 bg-cat-1-tint text-cat-1",
  2: "border-2 border-cat-2 bg-cat-2-tint text-cat-2",
  3: "border-2 border-cat-3 bg-cat-3-tint text-cat-3",
  4: "border-2 border-cat-4 bg-cat-4-tint text-cat-4",
  5: "border-2 border-cat-5 bg-cat-5-tint text-cat-5",
  6: "border-2 border-cat-6 bg-cat-6-tint text-cat-6",
  7: "border-2 border-cat-7 bg-cat-7-tint text-cat-7",
  8: "border-2 border-cat-8 bg-cat-8-tint text-cat-8",
};

function nicheChipClasses(niche: string, active = false): string {
  const slot = NICHE_CAT_SLOT[niche] ?? 1;
  return active ? CAT_CHIP_ACTIVE[slot] : CAT_CHIP[slot];
}

function styleChipClasses(style: ContentStyle, active = false): string {
  const slot = STYLE_CAT_SLOT[style];
  return active ? CAT_CHIP_ACTIVE[slot] : CAT_CHIP[slot];
}

// Deep, muted placeholder tones (shown while a cover image loads or is
// missing) — anchored to slate-900 so they read as premium dark thumbnails
// rather than saturated neon fills.
const CARD_GRADIENTS = [
  "from-slate-600 to-slate-900",
  "from-indigo-800 to-slate-900",
  "from-rose-900 to-slate-900",
  "from-teal-800 to-slate-900",
  "from-amber-800 to-slate-900",
  "from-violet-800 to-slate-900",
  "from-blue-800 to-slate-900",
  "from-emerald-800 to-slate-900",
];

function gradientForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
}

const PLATFORM_BADGE: Record<TrendingVideo["platform"], { label: string; className: string }> = {
  tiktok: { label: "TikTok", className: "bg-red-600" },
  // YouTube's own red (#FF0000) rather than reusing tiktok's bg-red-600 —
  // close enough to each other otherwise that the two badges would be hard
  // to tell apart at a glance.
  youtube: { label: "YouTube", className: "bg-[#FF0000]" },
};

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

// "Infinite" pagination: the API never reports a total, just whether there's
// a next page (see hasMore in /api/niches/[niche]/videos), so this only ever
// shows the current page number and a Next button — no total page count.
function Pagination({
  page,
  hasMore,
  onChange,
}: {
  page: number;
  hasMore: boolean;
  onChange: (page: number) => void;
}) {
  if (page === 1 && !hasMore) return null;

  return (
    <nav aria-label="Trending videos pagination" className="mt-6 flex items-center justify-center gap-3">
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

      <span className="text-xs font-semibold text-body">Page {page}</span>

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={!hasMore}
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


function TrendingVideoCard({ video }: { video: TrendingVideo }) {
  const [saved, setSaved] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const timeAgo = formatTimeAgo(video.postedAt);
  const niche = video.niche;
  const style = videoStyle(video);

  return (
    <div className="flex flex-col overflow-hidden rounded-card-lg border border-hairline bg-surface shadow-card transition-shadow hover:shadow-card-hover">
      <div className="group relative aspect-[9/16] w-full overflow-hidden bg-ink">
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
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white",
              PLATFORM_BADGE[video.platform].className
            )}
          >
            {PLATFORM_BADGE[video.platform].label}
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
          aria-label={`Watch "${video.title}" on ${PLATFORM_BADGE[video.platform].label}`}
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

      <div className="flex flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold leading-none", nicheChipClasses(niche))}>
            {niche}
          </span>
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold leading-none", styleChipClasses(style))}>
            {STYLE_LABEL[style]}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {video.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-5 w-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-white">
                {initialsFor(video.author)}
              </div>
            )}
            <span className="truncate text-[11px] font-semibold text-heading">{video.author}</span>
          </div>
          {video.followerCount > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-body" title="Followers">
              <Users className="h-3 w-3" />
              {formatCompactNumber(video.followerCount)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2 text-[11px] text-body">
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
    </div>
  );
}

// Hard ceiling on how long a page fetch is allowed to hang before the UI
// gives up and shows an error instead of spinning forever. Kept comfortably
// above the API route's own maxDuration (60s) so the server's own timeout
// fires first under normal conditions — this is purely a client-side
// backstop for the case where the connection is dropped silently instead of
// a response ever coming back.
const FETCH_TIMEOUT_MS = 70_000;

export function NicheFinder({
  initialVideos,
  initialHasMore,
  nicheCounts,
  availableNiches,
}: {
  initialVideos: TrendingVideo[];
  initialHasMore: boolean;
  nicheCounts: Record<string, number>;
  availableNiches: string[];
}) {
  const [videoPlatform, setVideoPlatform] = useState<VideoPlatformFilter>("all");
  const [videoTimeWindow, setVideoTimeWindow] = useState<VideoTimeWindow>("30d");
  const [videoRangeFilters, setVideoRangeFilters] = useState<VideoRangeFilters>(EMPTY_VIDEO_RANGE_FILTERS);
  const { selected: selectedVideoNiches } = useNicheSidebar();
  const activeNiche = selectedVideoNiches.size > 0 ? [...selectedVideoNiches][0] : null;

  useNicheSidebarSync(availableNiches, nicheCounts);

  // Videos are fetched a page at a time from /api/niches/[niche]/videos —
  // that route owns the "scrape once, cache in Supabase, paginate from
  // there" logic, so this component just asks for a page and renders it.
  const [videos, setVideos] = useState<TrendingVideo[]>(initialVideos);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [videoPage, setVideoPage] = useState(1);

  // Reset to page 1 whenever a filter (not the page itself) changes.
  // Adjusting state during render — rather than in an effect — avoids an
  // extra commit/fetch round-trip.
  const filtersKey = `${activeNiche ?? "all"}:${videoPlatform}:${videoTimeWindow}:${JSON.stringify(videoRangeFilters)}`;
  const [lastFiltersKey, setLastFiltersKey] = useState(filtersKey);
  if (filtersKey !== lastFiltersKey) {
    setLastFiltersKey(filtersKey);
    setVideoPage(1);
  }
  const effectiveVideoPage = filtersKey !== lastFiltersKey ? 1 : videoPage;

  // The server already rendered these exact params for the first paint —
  // skip the redundant duplicate fetch on mount. Compared against a fixed
  // snapshot (not a boolean flag) so this stays correct under React Strict
  // Mode's dev-only double-invoke, which would otherwise flip a boolean
  // guard on the throwaway first pass and fetch for real on the second.
  // Only trusted when the SSR pass actually returned videos — an empty SSR
  // result is indistinguishable from a real "no matches" here, so a null
  // snapshot (never equal to a paramsKey string) forces a real client fetch
  // instead of permanently freezing on a possibly-transient SSR hiccup.
  const initialParamsRef = useRef(initialVideos.length > 0 ? filtersKey + ":1" : null);

  // Only the response from the most recently issued request is ever applied
  // to state — belt-and-suspenders alongside AbortController so a slower
  // older request can never clobber a faster newer one's result.
  const latestRequestIdRef = useRef(0);

  useEffect(() => {
    const paramsKey = `${filtersKey}:${effectiveVideoPage}`;
    if (paramsKey === initialParamsRef.current) return;

    const requestId = ++latestRequestIdRef.current;
    const controller = new AbortController();
    // A dropped/hung connection never rejects the fetch on its own — this
    // is what guarantees the "Fetching fresh videos…" state always resolves
    // to something (data or an error) instead of spinning indefinitely.
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    async function loadVideos() {
      setVideosLoading(true);
      setVideosError(null);
      try {
        const qs = new URLSearchParams({
          page: String(effectiveVideoPage),
          limit: String(VIDEOS_PER_PAGE),
          platform: videoPlatform,
          timeWindow: videoTimeWindow,
        });
        if (videoRangeFilters.viewsMin) qs.set("viewsMin", videoRangeFilters.viewsMin);
        if (videoRangeFilters.viewsMax) qs.set("viewsMax", videoRangeFilters.viewsMax);
        if (videoRangeFilters.followersMin) qs.set("followersMin", videoRangeFilters.followersMin);
        if (videoRangeFilters.followersMax) qs.set("followersMax", videoRangeFilters.followersMax);
        if (videoRangeFilters.postedAfter) qs.set("postedAfter", videoRangeFilters.postedAfter);
        if (videoRangeFilters.postedBefore) qs.set("postedBefore", videoRangeFilters.postedBefore);

        const res = await fetch(`/api/niches/${encodeURIComponent(activeNiche ?? "all")}/videos?${qs.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json || !Array.isArray(json.videos)) {
          throw new Error((json && typeof json.error === "string" && json.error) || "Failed to load videos");
        }
        if (latestRequestIdRef.current !== requestId) return;
        setVideos(json.videos);
        setHasMore(Boolean(json.hasMore));
      } catch (err) {
        if (latestRequestIdRef.current !== requestId) return;
        // A superseded request (filters/page changed again before this one
        // finished) is aborted too — that's not a real failure, the newer
        // request's own loadVideos() call owns the loading/error state.
        if (err instanceof DOMException && err.name === "AbortError" && !timedOut) return;
        setVideos([]);
        setVideosError(
          timedOut ? "Taking too long to load — try again." : "Couldn't load videos. Try again."
        );
      } finally {
        clearTimeout(timeoutId);
        if (latestRequestIdRef.current === requestId) setVideosLoading(false);
      }
    }

    loadVideos();
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [activeNiche, videoPlatform, videoTimeWindow, videoRangeFilters, effectiveVideoPage, filtersKey]);

  return (
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

      <div className="mt-4">
        {videos.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-body">
            Page {effectiveVideoPage}
            {videosLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </p>
        )}

        {/* Priority order: a real error always wins (even if stale videos
            are still in state), then videos, then the loading spinner —
            which is now guaranteed to resolve to one of the other three
            branches within FETCH_TIMEOUT_MS — then the platform-specific
            and generic empty fallbacks. Nothing here can spin forever. */}
        {videosError ? (
          <div className="rounded-xl border border-dashed border-danger/40 bg-surface p-8 text-center text-sm text-danger">
            {videosError}
          </div>
        ) : videos.length > 0 ? (
          <>
            <div
              className={cn(
                "mt-3 grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-3 sm:gap-4 xl:grid-cols-4",
                videosLoading && "opacity-50"
              )}
            >
              {videos.map((video) => (
                <TrendingVideoCard key={video.id} video={video} />
              ))}
            </div>
            <Pagination page={effectiveVideoPage} hasMore={hasMore} onChange={setVideoPage} />
          </>
        ) : videosLoading ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline bg-surface p-8 text-center text-sm text-body">
            <Loader2 className="h-4 w-4 animate-spin" />
            {activeNiche
              ? `Fetching fresh ${activeNiche} videos — first look at a niche can take up to a minute.`
              : "Loading videos…"}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-hairline bg-surface p-8 text-center text-sm text-body">
            No live videos match the current filters.
          </div>
        )}
      </div>
    </section>
  );
}
