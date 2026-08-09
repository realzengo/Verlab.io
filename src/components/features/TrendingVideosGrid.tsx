import { Bookmark, Info, Play } from "lucide-react";
import { TikTokIcon, YouTubeIcon } from "@/components/landing/PlatformIcons";
import { cn } from "@/lib/utils";

export interface TrendingVideo {
  id: string;
  thumbnailUrl: string;
  /** Real niche/category label (e.g. "Map Animations & Geography") -- not
   * restricted to a fixed enum, since our real verified niches don't fit
   * a small fixed set like SPORTS/MEDIA/HISTORY/ENTERTAINMENT. */
  category: string;
  platform: "youtube" | "tiktok";
  timeAgo: string;
  viewsCount: string;
  likesCount: string;
  videoUrl?: string;
}

// Same 8-slot categorical palette used elsewhere in the app for niche chips
// (dataviz-validated order) -- a hash of the category string picks a stable
// slot so a given niche always renders the same color everywhere, without
// needing a fixed enum of known categories.
const CATEGORY_BADGE_CLASSES: Record<number, string> = {
  1: "bg-cat-1",
  2: "bg-cat-2",
  3: "bg-cat-3",
  4: "bg-cat-4",
  5: "bg-cat-5",
  6: "bg-cat-6",
  7: "bg-cat-7",
  8: "bg-cat-8",
};

// Fixed colors for known format labels (checked against real `niche` values
// via substring match, e.g. "Reddit Story" still hits REDDIT) -- any real
// niche that isn't one of these known formats falls back to the hash-based
// palette above instead of a default gray, since our verified channels
// aren't restricted to this list.
const KNOWN_CATEGORY_BADGE_CLASSES: [string, string][] = [
  ["COMMENTARY", "bg-blue-600"],
  ["SPORTS", "bg-blue-600"],
  ["REDDIT", "bg-orange-600"],
  ["STORIES", "bg-amber-600"],
  ["MYSTERY", "bg-purple-600"],
  ["CRIME", "bg-rose-700"],
  ["ANIMATION", "bg-emerald-600"],
  ["CINEMA", "bg-red-600"],
  ["MOVIES-TV", "bg-red-600"],
  ["MOVIES", "bg-red-600"],
  ["SCIENCE", "bg-cyan-600"],
  ["ANIME", "bg-rose-600"],
  ["GAMING", "bg-purple-600"],
  ["QUIZ-TRIVIA", "bg-indigo-600"],
  ["QUIZ", "bg-indigo-600"],
  ["ANIMALS", "bg-teal-600"],
];

function categoryBadgeClass(category: string): string {
  const normalized = category.toUpperCase().replace(/[\s&/]+/g, "-");
  const known = KNOWN_CATEGORY_BADGE_CLASSES.find(([key]) => normalized.includes(key));
  if (known) return known[1];

  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return CATEGORY_BADGE_CLASSES[(hash % 8) + 1];
}

function PlatformBadge({ platform }: { platform: TrendingVideo["platform"] }) {
  if (platform === "youtube") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 shadow-sm">
        <YouTubeIcon className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black shadow-sm">
      <TikTokIcon className="h-3.5 w-3.5" />
    </span>
  );
}

function TrendingVideoCard({ video }: { video: TrendingVideo }) {
  const Wrapper = video.videoUrl ? "a" : "div";

  return (
    <Wrapper
      {...(video.videoUrl ? { href: video.videoUrl, target: "_blank", rel: "noreferrer" } : {})}
      className="group relative aspect-[9/16] cursor-pointer select-none overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-md"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={video.thumbnailUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/90 via-transparent to-black/60" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black/90 via-transparent to-black/60" />

      <span
        className={cn(
          "absolute left-3 top-3 z-20 max-w-[70%] truncate rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-sm",
          categoryBadgeClass(video.category)
        )}
        title={video.category}
      >
        {video.category}
      </span>

      <span className="absolute right-3 top-3 z-20">
        <PlatformBadge platform={video.platform} />
      </span>

      <span className="absolute inset-0 z-20 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-transform duration-200 group-hover:scale-110">
          <Play className="h-5 w-5 translate-x-0.5 fill-white text-white" />
        </span>
      </span>

      <span className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          aria-label="Bookmark"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-md transition-all hover:bg-black/60 hover:text-white"
        >
          <Bookmark className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          aria-label="Video info"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-md transition-all hover:bg-black/60 hover:text-white"
        >
          <Info className="h-4 w-4" />
        </button>
      </span>

      <span className="absolute bottom-3 left-3 z-20 flex flex-col gap-0.5 text-[11px] font-medium text-white/90">
        <span>{video.timeAgo}</span>
        <span>
          👁 {video.viewsCount}  👤 {video.likesCount}
        </span>
      </span>
    </Wrapper>
  );
}

/**
 * Pure presentational grid -- deliberately has no built-in mock/fallback
 * data. Videos come only from verified channels' real recent_videos (see
 * deriveTrendingVideos in FacelessNicheFinder.tsx); an empty `videos` array
 * renders nothing rather than synthesizing cards that would look identical
 * to verified data but aren't.
 */
export function TrendingVideosGrid({ videos }: { videos: TrendingVideo[] }) {
  if (videos.length === 0) return null;

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
      {videos.map((video) => (
        <TrendingVideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
