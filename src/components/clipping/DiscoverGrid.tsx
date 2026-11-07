"use client";

import { useState } from "react";
import useSWR from "swr";
import { Eye, Heart, MessageCircle, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { CreditCost } from "@/components/ui/CreditCost";
import { YouTubeIcon } from "@/components/landing/PlatformIcons";
import { fetchJson } from "@/components/clipping/parts";
import { getClippingCost } from "@/lib/config/pricing";
import {
  DISCOVER_CATEGORIES,
  formatClock,
  formatCompactNumber,
  type ClipSourceVideo,
  type DiscoverCategory,
} from "@/lib/clips";
import { cn } from "@/lib/utils";

const SKELETON_CARDS = 9;

export function DiscoverGrid({ onPick }: { onPick: (video: ClipSourceVideo) => void }) {
  const [category, setCategory] = useState<DiscoverCategory>("recommended");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const key = query ? `/api/clips/discover?q=${encodeURIComponent(query)}` : `/api/clips/discover?category=${category}`;
  const { data, error, isLoading } = useSWR<{ videos: ClipSourceVideo[] }>(key, fetchJson, {
    revalidateOnFocus: false,
    keepPreviousData: false,
  });

  return (
    <section className="mx-auto mt-16 w-full max-w-5xl sm:mt-24">
      <div className="flex flex-col items-center text-center">
        <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-heading sm:text-[32px]">Or choose</h2>
        <p className="mt-1.5 text-sm text-subtle">Find a video worth clipping</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(draft.trim());
          }}
          className="mt-5 flex h-12 w-full max-w-md items-center sm:mt-6 sm:h-11 gap-2.5 rounded-full border border-hairline bg-surface pl-4 pr-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 dark:bg-white/[0.03]"
        >
          <Search className="h-4 w-4 shrink-0 text-subtle" strokeWidth={1.75} />
          <input
            type="search"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (!event.target.value.trim()) setQuery("");
            }}
            placeholder="Search YouTube"
            aria-label="Search YouTube"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-heading outline-none sm:text-sm placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex h-9 w-12 shrink-0 items-center justify-center rounded-full bg-(--app-fill) sm:h-8 sm:w-11 outline-none transition-colors hover:bg-(--app-fill-strong) focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <YouTubeIcon className="h-4 w-4" />
          </button>
        </form>

        <div
          role="tablist"
          aria-label="Categories"
          className="-mx-4 mt-4 flex gap-2 self-stretch overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:max-w-full sm:flex-wrap sm:justify-center sm:self-auto sm:overflow-visible sm:px-0"
        >
          {DISCOVER_CATEGORIES.map((item) => {
            const active = !query && category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setCategory(item.id);
                  setQuery("");
                  setDraft("");
                }}
                className={cn(
                  "h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 sm:h-8 sm:px-3.5",
                  active
                    ? "border-transparent bg-heading text-surface dark:bg-white dark:text-[#0B0D12]"
                    : "border-hairline text-body hover:bg-(--app-fill) hover:text-heading"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-7 sm:mt-8 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-3">
        {isLoading || (!data && !error)
          ? Array.from({ length: SKELETON_CARDS }, (_, index) => <VideoCardSkeleton key={index} />)
          : null}
        {data?.videos.map((video) => (
          <VideoCard key={video.id} video={video} onPick={() => onPick(video)} />
        ))}
      </div>

      {error && <p className="mt-2 text-center text-sm text-danger">{error.message}</p>}
      {data && data.videos.length === 0 && (
        <p className="mt-2 text-center text-sm text-subtle">
          {query ? "No long videos matched that search." : "Nothing here right now. Try another category."}
        </p>
      )}
    </section>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Eye; value: number | null; label: string }) {
  const text = formatCompactNumber(value);
  if (!text) return null;
  return (
    <span className="flex items-center gap-1" aria-label={`${text} ${label}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {text}
    </span>
  );
}

function VideoCard({ video, onPick }: { video: ClipSourceVideo; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex flex-col text-left outline-none transition-transform duration-150 active:scale-[0.985] sm:active:scale-100"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-(--app-fill-strong) ring-primary/50 transition-shadow group-focus-visible:ring-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail */}
        <img
          src={video.thumbnailUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
        />
        <span
          title="Credits to clip this video"
          aria-label={`${getClippingCost(video.durationSeconds)} credits`}
          className="absolute left-2 top-2 inline-flex h-6 items-center rounded-full bg-primary px-2 text-[11px] font-semibold text-white shadow-sm"
        >
          <CreditCost
            amount={getClippingCost(video.durationSeconds)}
            bullet={false}
            className="gap-0.5 [&>svg]:h-3 [&>svg]:w-3"
          />
        </span>
        <span className="absolute bottom-2 right-2 rounded-[5px] bg-black/75 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white">
          {formatClock(video.durationSeconds)}
        </span>
      </div>
      <div className="mt-3 flex gap-2.5">
        {video.channelAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote channel avatar
          <img
            src={video.channelAvatarUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover sm:h-7 sm:w-7"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--app-fill-strong) text-[11px] font-semibold text-subtle sm:h-7 sm:w-7">
            {video.channelTitle.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[14px] font-medium leading-snug text-heading sm:text-[13px]">{video.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-subtle">{video.channelTitle}</p>
          <div className="mt-1.5 flex items-center gap-3 text-[12px] tabular-nums text-subtle">
            <Stat icon={Eye} value={video.views} label="views" />
            <Stat icon={Heart} value={video.likes} label="likes" />
            <Stat icon={MessageCircle} value={video.comments} label="comments" />
          </div>
        </div>
      </div>
    </button>
  );
}

function VideoCardSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="mt-3 flex gap-2.5">
        <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2 pt-0.5">
          <Skeleton className="h-3.5 w-11/12 rounded-full" />
          <Skeleton className="h-3 w-1/2 rounded-full" />
          <Skeleton className="h-3 w-2/3 rounded-full" />
        </div>
      </div>
    </div>
  );
}
