"use client";

import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import Link from "next/link";
import { BadgeCheck, Compass, Eye, Heart, MessageCircle, Play, Share2, Users, VenetianMask, Wand2 } from "lucide-react";
import { TikTokIcon, YouTubeIcon } from "@/components/landing/PlatformIcons";
import { SearchLoadingLogo } from "@/components/ui/SearchLoadingLogo";
import {
  EMPTY_VIDEO_RANGE_FILTERS,
  NicheTopBar,
  PaginationControls,
  SegmentedControl,
  type VideoPlatformFilter,
  type VideoRangeFilters,
  type VideoSort,
  type VideoTimeWindow,
} from "@/components/features/NicheTopBar";
import { useNicheSidebar, useNicheSidebarSync } from "@/components/dashboard/NicheSidebarContext";
import { ToolFrame } from "@/components/dashboard/ToolFrame";
import { VideoDetailModal } from "@/components/features/VideoDetailModal";
import { SavedVideosProvider, useSavedVideos } from "@/components/features/SavedVideosContext";
import { cn } from "@/lib/utils";
import { isPlainTextSafe, SHORT_TEXT_MAX } from "@/lib/validation";
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

export function gradientForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
}

export const PLATFORM_BADGE: Record<
  TrendingVideo["platform"],
  { label: string; icon: typeof YouTubeIcon }
> = {
  tiktok: { label: "TikTok", icon: TikTokIcon },
  youtube: { label: "YouTube", icon: YouTubeIcon },
};

export function formatCompactNumber(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}

export function formatTimeAgo(isoDate: string | null): string | null {
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


export function TrendingVideoCard({ video, onOpen }: { video: TrendingVideo; onOpen: (video: TrendingVideo) => void }) {
  const { isSaved, toggleSave } = useSavedVideos();
  const saved = isSaved(video.id);
  // TikTok's stored coverUrl is a signed CDN link that can expire long
  // before a user actually views the card, or be missing outright if the
  // scrape response omitted it (see /api/media/tiktok-thumb) -- one retry
  // through that proxy (which mints a brand-new URL on demand) before
  // falling back to the plain gradient+play-icon card.
  const tiktokThumbFallbackUrl = `/api/media/tiktok-thumb?url=${encodeURIComponent(video.videoUrl)}`;
  const [coverSrc, setCoverSrc] = useState(
    video.coverUrl || (video.platform === "tiktok" ? tiktokThumbFallbackUrl : "")
  );
  const triedThumbFallback = useRef(!video.coverUrl);
  const [coverFailed, setCoverFailed] = useState(false);
  const timeAgo = formatTimeAgo(video.postedAt);
  const niche = video.niche;
  const style = videoStyle(video);
  const analysis = video.transcriptAnalysis?.status === "analyzed" ? video.transcriptAnalysis : null;
  const PlatformIcon = PLATFORM_BADGE[video.platform].icon;

  function handleCoverError() {
    if (!triedThumbFallback.current && video.platform === "tiktok") {
      triedThumbFallback.current = true;
      setCoverSrc(tiktokThumbFallbackUrl);
      return;
    }
    setCoverFailed(true);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(video)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(video);
        }
      }}
      aria-label={`View details for "${video.title}"`}
      className="group/card flex cursor-pointer flex-col overflow-hidden rounded-card-lg border border-hairline bg-surface shadow-card transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/25 hover:shadow-card-hover dark:bg-black"
    >
      <div className="group relative aspect-[9/16] w-full overflow-hidden bg-ink">
        <div className={cn("absolute inset-0 bg-gradient-to-br", gradientForId(video.id))} />
        {coverSrc && !coverFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverSrc}
            alt=""
            referrerPolicy="no-referrer"
            onError={handleCoverError}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/50" />

        <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-black/45 py-1 pl-2 pr-2 ring-1 ring-inset ring-white/15 backdrop-blur-md">
            <PlatformIcon className="h-3 w-3 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-wide text-white">
              {PLATFORM_BADGE[video.platform].label}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSave(video);
          }}
          aria-label="Save video"
          aria-pressed={saved}
          className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-inset ring-white/15 backdrop-blur-md transition-all hover:bg-black/55 active:scale-90"
        >
          <Heart className={cn("h-3.5 w-3.5 transition-colors", saved && "fill-red-500 text-red-500")} />
        </button>

        <div className="absolute inset-0 flex items-center justify-center opacity-90 transition-opacity group-hover:opacity-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-card-hover ring-1 ring-inset ring-black/5 transition-transform duration-200 group-hover:scale-110">
            <Play className="h-4.5 w-4.5 translate-x-0.5 fill-ink text-ink" />
          </div>
        </div>

        <div className="absolute bottom-2.5 left-2.5 right-11">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 ring-1 ring-inset ring-white/10 backdrop-blur-md">
            <Eye className="h-3 w-3 text-white/80" />
            <span className="text-[10px] font-bold tabular-nums text-white">{video.views} views</span>
          </span>
        </div>

        <div className="absolute bottom-2.5 right-2.5 z-10">
          <Link
            href="/bend"
            onClick={(e) => e.stopPropagation()}
            aria-label="Bend this script"
            title="Bend this script"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary shadow-card transition-all hover:scale-110 hover:bg-accent"
          >
            <Wand2 className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {analysis ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border-2 border-accent-line bg-accent px-2 py-0.5 text-[10px] font-bold leading-none text-primary"
              title={`AI-verified niche, ${analysis.confidence}% confidence`}
            >
              <BadgeCheck className="h-3 w-3" />
              {analysis.niche}
            </span>
          ) : (
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold leading-none", nicheChipClasses(niche))}>
              {niche}
            </span>
          )}
          {analysis?.is_faceless && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold leading-none text-white"
              title="AI-verified: no real face on camera"
            >
              <VenetianMask className="h-3 w-3" />
              Faceless
            </span>
          )}
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold leading-none", styleChipClasses(style))}>
            {STYLE_LABEL[style]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-heading">@{video.author}</span>
          {video.followerCount > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-subtle" title="Followers">
              <Users className="h-3 w-3" />
              {formatCompactNumber(video.followerCount)}
            </span>
          )}
        </div>

        <div className="h-px bg-hairline" />

        <div className="flex items-center justify-between gap-2 text-[11px] font-medium tabular-nums text-body">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="flex items-center gap-1 transition-colors hover:text-heading" title="Views">
              <Eye className="h-3 w-3" />
              {video.views}
            </span>
            <span className="flex items-center gap-1 transition-colors hover:text-heading" title="Likes">
              <Heart className="h-3 w-3" />
              {formatCompactNumber(video.likeCount)}
            </span>
            <span className="flex items-center gap-1 transition-colors hover:text-heading" title="Comments">
              <MessageCircle className="h-3 w-3" />
              {formatCompactNumber(video.commentCount)}
            </span>
            <span className="flex items-center gap-1 transition-colors hover:text-heading" title="Shares">
              <Share2 className="h-3 w-3" />
              {formatCompactNumber(video.shareCount)}
            </span>
          </div>
          {timeAgo && <span className="shrink-0 text-subtle">{timeAgo}</span>}
        </div>
      </div>
    </div>
  );
}

/** Placeholder tile shown in place of a card while saved videos are still
 * loading -- mirrors TrendingVideoCard's proportions so the grid doesn't
 * visibly reflow once the real cards swap in. */
function LikedVideoCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col overflow-hidden rounded-card-lg border border-hairline bg-surface">
      <div className="aspect-[9/16] w-full bg-app" />
      <div className="flex flex-col gap-3 p-3.5 sm:p-4">
        <div className="h-4 w-16 rounded-full bg-app" />
        <div className="h-3 w-2/3 rounded-full bg-app" />
        <div className="h-px bg-hairline" />
        <div className="h-3 w-full rounded-full bg-app" />
      </div>
    </div>
  );
}

function LikedVideosSection({
  videos,
  loading,
  onOpen,
}: {
  videos: TrendingVideo[];
  loading: boolean;
  onOpen: (video: TrendingVideo) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-heading sm:text-lg">Liked videos</h2>
          <p className="mt-0.5 text-xs font-medium text-body sm:text-sm">
            {loading
              ? "Loading your saved videos…"
              : videos.length > 0
                ? `${videos.length} video${videos.length === 1 ? "" : "s"} saved for later`
                : "Videos you save from Discover land here"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <LikedVideoCardSkeleton key={i} />
          ))}
        </div>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <TrendingVideoCard key={video.id} video={video} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-hairline bg-surface p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
            <Heart className="h-6 w-6 text-danger" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-heading">No liked videos yet</p>
            <p className="mx-auto max-w-sm text-sm text-body">
              Tap the heart on any video in Discover to save it here for quick reference later.
            </p>
          </div>
        </div>
      )}
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

type NicheFinderView = "discover" | "liked";

export function NicheFinder(props: {
  initialVideos: TrendingVideo[];
  initialHasMore: boolean;
  nicheCounts: Record<string, number>;
  availableNiches: string[];
}) {
  // SavedVideosProvider has to sit above NicheFinderInner (not inside it) so
  // its own useSavedVideos() call — driving the "Liked" tab's grid — has a
  // provider to read from.
  return (
    <SavedVideosProvider>
      <NicheFinderInner {...props} />
    </SavedVideosProvider>
  );
}

function NicheFinderInner({
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
  // Warms the browser cache for the loading logo the moment this page
  // mounts, so by the time a search actually triggers the loading overlay
  // the image paints instantly instead of racing a fresh network request.
  preload("/logo-circle.png", { as: "image" });

  const [activeView, setActiveView] = useState<NicheFinderView>("discover");
  const { savedVideos, savedVideosLoading } = useSavedVideos();

  const [videoPlatform, setVideoPlatform] = useState<VideoPlatformFilter>("all");
  const [videoTimeWindow, setVideoTimeWindow] = useState<VideoTimeWindow>("30d");
  const [videoRangeFilters, setVideoRangeFilters] = useState<VideoRangeFilters>(EMPTY_VIDEO_RANGE_FILTERS);
  const [videoSort, setVideoSort] = useState<VideoSort>("views");
  // The input box updates this on every keystroke; videoQuery (the value
  // that actually drives the fetch below) only picks it up on submit, so
  // typing doesn't fire a request per character.
  const [queryDraft, setQueryDraft] = useState("");
  const [videoQuery, setVideoQuery] = useState("");
  // Subtle inline note (not a hard error) shown when a submitted search
  // gets rejected client-side for containing control characters or raw
  // HTML tags -- see isPlainTextSafe's gate in submitVideoQuery below.
  const [queryError, setQueryError] = useState<string | null>(null);

  function submitVideoQuery(raw: string) {
    const trimmed = raw.trim();
    if (trimmed && !isPlainTextSafe(trimmed, SHORT_TEXT_MAX)) {
      setQueryError("That search contains characters that aren't supported.");
      return;
    }
    setQueryError(null);
    setVideoQuery(trimmed);
  }
  const { selected: selectedVideoNiches } = useNicheSidebar();
  const activeNiche = selectedVideoNiches.size > 0 ? [...selectedVideoNiches][0] : null;
  const [detailVideo, setDetailVideo] = useState<TrendingVideo | null>(null);

  useNicheSidebarSync(availableNiches, nicheCounts);

  // Videos are fetched a page at a time from /api/niches/[niche]/videos —
  // that route owns the "scrape once, cache in Supabase, paginate from
  // there" logic, so this component just asks for a page and renders it.
  const [videos, setVideos] = useState<TrendingVideo[]>(initialVideos);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [videoPage, setVideoPage] = useState(1);
  // True when nothing cleared the requested view-count floor and the server
  // dropped it to show the closest matches instead of an empty page.
  const [videosRelaxedFilters, setVideosRelaxedFilters] = useState(false);

  // Paging also happens from the rail at the bottom of the grid (after
  // scrolling through a full page of results), so changing page always
  // jumps back to the top -- otherwise the new page loads in off-screen,
  // below whatever the user had scrolled down to see.
  const sectionRef = useRef<HTMLElement>(null);
  function handleVideoPageChange(nextPage: number) {
    setVideoPage(nextPage);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Reset to page 1 whenever a filter (not the page itself) changes.
  // Adjusting state during render — rather than in an effect — avoids an
  // extra commit/fetch round-trip.
  const filtersKey = `${activeNiche ?? "all"}:${videoPlatform}:${videoTimeWindow}:${videoSort}:${videoQuery}:${JSON.stringify(videoRangeFilters)}`;
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
          sort: videoSort,
        });
        if (videoQuery) qs.set("q", videoQuery);
        if (videoRangeFilters.viewsMin) qs.set("viewsMin", videoRangeFilters.viewsMin);
        if (videoRangeFilters.viewsMax) qs.set("viewsMax", videoRangeFilters.viewsMax);
        if (videoRangeFilters.followersMin) qs.set("followersMin", videoRangeFilters.followersMin);
        if (videoRangeFilters.followersMax) qs.set("followersMax", videoRangeFilters.followersMax);
        if (videoRangeFilters.countries.length > 0) qs.set("country", videoRangeFilters.countries.join(","));

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
        setVideosRelaxedFilters(Boolean(json.relaxedFilters));
      } catch (err) {
        if (latestRequestIdRef.current !== requestId) return;
        // A superseded request (filters/page changed again before this one
        // finished) is aborted too — that's not a real failure, the newer
        // request's own loadVideos() call owns the loading/error state.
        if (err instanceof DOMException && err.name === "AbortError" && !timedOut) return;
        setVideos([]);
        setVideosRelaxedFilters(false);
        setVideosError(
          timedOut ? "Taking too long to load. Try again." : "Couldn't load videos. Try again."
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
  }, [activeNiche, videoPlatform, videoTimeWindow, videoSort, videoQuery, videoRangeFilters, effectiveVideoPage, filtersKey]);

  const viewTabs: { id: NicheFinderView; label: string; icon: typeof Compass }[] = [
    { id: "discover", label: "Discover", icon: Compass },
    { id: "liked", label: savedVideos.length > 0 ? `Liked · ${savedVideos.length}` : "Liked", icon: Heart },
  ];

  return (
    <section ref={sectionRef}>
      <div className="-mx-4 bg-surface px-4 pb-4 pt-4 dark:bg-[#000000] sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
        <SegmentedControl ariaLabel="Niche Finder view" items={viewTabs} value={activeView} onChange={setActiveView} />
      </div>

      {activeView === "liked" ? (
        <LikedVideosSection videos={savedVideos} loading={savedVideosLoading} onOpen={setDetailVideo} />
      ) : (
        <>
          <NicheTopBar
            query={queryDraft}
            onQueryChange={setQueryDraft}
            onSearchSubmit={() => submitVideoQuery(queryDraft)}
            queryError={queryError}
            loading={videosLoading}
            platform={videoPlatform}
            onPlatformChange={setVideoPlatform}
            timeWindow={videoTimeWindow}
            onTimeWindowChange={setVideoTimeWindow}
            rangeFilters={videoRangeFilters}
            onApplyRangeFilters={setVideoRangeFilters}
            onClearRangeFilters={() => setVideoRangeFilters(EMPTY_VIDEO_RANGE_FILTERS)}
            sort={videoSort}
            onSortChange={setVideoSort}
          />

          <ToolFrame
            className="mt-4"
            title="Niche Finder"
            description="Non-competitive faceless niches, backed by real transcripts, not vague metadata guesses."
          >
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
              <div className="relative">
                {videosRelaxedFilters && (
                  <div className="mb-4 rounded-lg border border-dashed border-hairline bg-surface px-4 py-2 text-xs text-body">
                    No videos matched your view-count filter, showing the closest matches instead.
                  </div>
                )}
                <div
                  className={cn(
                    "grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4",
                    videosLoading && "opacity-40"
                  )}
                >
                  {videos.map((video) => (
                    <TrendingVideoCard key={video.id} video={video} onOpen={setDetailVideo} />
                  ))}
                </div>
                {videosLoading && (
                  // Scoped to the grid's own box (not the full page) so the
                  // header and filters stay sharp -- z-10 keeps it strictly
                  // below the top bar's own z-20, so it can never paint over
                  // it even mid-scroll. Bleeds out on all four sides by the
                  // same -4/6/8 amount as ToolFrame's own p-4/6/8 padding,
                  // so the overlay reaches the card's true edge on every
                  // side instead of just left/right -- an inset-y-0 top
                  // edge would stop short of that padding and leave a
                  // visible sharp margin above a hard-cut blur line.
                  // `sticky` keeps the spinner centered on whatever part of
                  // the grid is in view, even when the grid itself is
                  // taller than the viewport.
                  <div className="absolute -inset-4 z-10 overflow-hidden rounded-2xl bg-app/60 backdrop-blur-md sm:-inset-6 md:-inset-8">
                    <div className="sticky top-1/2 flex -translate-y-1/2 items-center justify-center">
                      <SearchLoadingLogo size={140} />
                    </div>
                  </div>
                )}
              </div>
            ) : videosLoading ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-hairline bg-surface p-10 text-center text-sm text-body">
                <SearchLoadingLogo size={140} />
                {activeNiche
                  ? `Fetching fresh ${activeNiche} videos, first look at a niche can take up to a minute.`
                  : "Loading videos…"}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-hairline bg-surface p-8 text-center text-sm text-body">
                No live videos match the current filters.
              </div>
            )}

            {/* Mirrors the pager in NicheTopBar -- after scrolling through a
                full page of results, reaching all the way back up to the
                sticky bar just to turn the page is annoying, so it's
                repeated here too. */}
            {!videosError && videos.length > 0 && (effectiveVideoPage > 1 || hasMore) && (
              <div className="mt-6 flex justify-center">
                <PaginationControls page={effectiveVideoPage} hasMore={hasMore} onPageChange={handleVideoPageChange} />
              </div>
            )}
          </ToolFrame>
        </>
      )}

      {detailVideo && (
        <VideoDetailModal
          key={detailVideo.id}
          video={detailVideo}
          relatedVideos={activeView === "liked" ? savedVideos : videos}
          onClose={() => setDetailVideo(null)}
          onSelectVideo={setDetailVideo}
        />
      )}
    </section>
  );
}
