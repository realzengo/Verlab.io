import { Skeleton } from "@/components/ui/Skeleton";

// Route-level loading screens for the dashboard pages. Each one mirrors its
// page's real wrappers, grid and card chrome so the content swaps in without
// the layout jumping -- if a page's layout changes, update its skeleton too.

export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-10 pt-6 sm:pt-8">
      {/* Creative tools */}
      <section>
        <Skeleton className="mb-6 h-6 w-36 rounded-full" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <Skeleton className="mt-3.5 h-4 w-40 rounded-full" />
              <Skeleton className="mt-2 h-3.5 w-56 max-w-full rounded-full" />
            </div>
          ))}
        </div>
      </section>

      {/* Top models */}
      <section>
        <Skeleton className="h-6 w-32 rounded-full" />
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:grid-cols-4 sm:gap-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col rounded-xl bg-(--app-fill) p-3 sm:rounded-2xl sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-5 w-5 rounded-md sm:h-7 sm:w-7" />
                <Skeleton className="h-4 w-10 rounded-md sm:h-5 sm:w-12" />
              </div>
              <Skeleton className="mt-3 h-3.5 w-20 rounded-full sm:mt-4 sm:h-4 sm:w-28" />
              <Skeleton className="mt-2 h-3 w-full rounded-full sm:h-3.5 sm:w-4/5" />
            </div>
          ))}
        </div>
      </section>

      {/* Browse our tools */}
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-6 w-44 rounded-full" />
            <Skeleton className="mt-2 h-3.5 w-60 max-w-full rounded-full" />
          </div>
          <Skeleton className="mb-1 h-4 w-24 shrink-0 rounded-full" />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col rounded-2xl border border-hairline bg-surface p-5">
              <Skeleton className="h-12 w-12 rounded-[22%]" />
              <Skeleton className="mt-4 h-4 w-28 rounded-full" />
              <Skeleton className="mt-2.5 h-3 w-full rounded-full" />
              <Skeleton className="mt-1.5 h-3 w-3/4 rounded-full" />
              <Skeleton className="mt-5 h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ToolsSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="w-full pt-2">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4 sm:gap-5">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-card border border-hairline bg-surface shadow-card dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-1 flex-col p-2.5">
              <Skeleton className="aspect-video w-full rounded-card-sm" />
              <div className="flex flex-col gap-2 pt-2.5 lg:pt-3.5">
                <Skeleton className="h-4 w-32 rounded-full" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-3 w-2/3 rounded-full" />
              </div>
            </div>
            <div className="px-2.5 pb-2.5 pt-1">
              <Skeleton className="h-9 w-full rounded-xl lg:h-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stand-in for NicheFinder's TrendingVideoCard -- same 9:16 cover and
 * footer rhythm, so the grid doesn't reflow when real cards arrive. */
export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface dark:bg-black">
      <Skeleton className="aspect-[9/16] w-full" />
      <div className="flex flex-col gap-3 p-3.5 sm:p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-24 rounded-full" />
          <Skeleton className="ml-auto h-3 w-10 rounded-full" />
        </div>
        <div className="h-px bg-hairline" />
        <div className="flex items-center gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-3 w-8 rounded-full" />
          ))}
          <Skeleton className="ml-auto h-3 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function VideoGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function NichesSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      {/* Discover / Liked */}
      <div className="-mx-4 bg-surface px-4 pb-4 pt-4 dark:bg-[#000000] sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
        <Skeleton className="h-9 w-44 rounded-xl" />
      </div>

      {/* Search + filters bar */}
      <div className="-mx-4 bg-surface px-4 dark:bg-[#000000] sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center gap-2 py-3 sm:gap-2.5">
          <Skeleton className="h-9 min-w-[220px] flex-1 rounded-xl" />
          <Skeleton className="h-9 w-10 rounded-xl sm:w-[74px]" />
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-48 rounded-xl" />
        </div>
        <div className="flex items-center border-t border-hairline/70 py-2">
          <Skeleton className="h-5 w-28 rounded-md" />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-hairline bg-surface p-4 shadow-card sm:p-6 md:p-8">
        <VideoGridSkeleton />
      </div>
    </div>
  );
}

export function LibrarySkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6 pt-2 sm:pt-4">
      <header>
        <Skeleton className="h-7 w-28 rounded-full sm:h-8" />
        <Skeleton className="mt-2.5 h-4 w-80 max-w-full rounded-full" />
      </header>

      <div className="flex flex-col-reverse gap-3 border-b border-hairline md:flex-row md:items-end md:justify-between">
        <div className="flex gap-5">
          {["w-6", "w-14", "w-11", "w-20"].map((width) => (
            <Skeleton key={width} className={`mb-3 h-4 rounded-full ${width}`} />
          ))}
        </div>
        <div className="flex items-center gap-2 md:pb-2">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <Skeleton className="aspect-square rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-3/4 rounded-full" />
              <Skeleton className="h-2.5 w-1/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A saved bend's SOP (library/[jobId]) -- header card plus section cards. */
export function LibraryItemSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6 pt-2">
      <Skeleton className="h-5 w-32 rounded-full" />

      <div className="flex flex-col gap-8 pb-16">
        <div className="rounded-card-lg border border-hairline bg-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex min-w-0 items-start gap-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-col">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="mt-2.5 h-7 w-64 max-w-full rounded-full" />
                <Skeleton className="mt-2.5 h-4 w-80 max-w-full rounded-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
          </div>
        </div>

        {[0, 1].map((i) => (
          <div key={i} className="rounded-card-lg border border-hairline bg-surface p-6 sm:p-8">
            <Skeleton className="h-5 w-40 rounded-full" />
            <div className="mt-5 flex flex-col gap-2.5">
              <Skeleton className="h-3.5 w-full rounded-full" />
              <Skeleton className="h-3.5 w-11/12 rounded-full" />
              <Skeleton className="h-3.5 w-4/5 rounded-full" />
              <Skeleton className="h-3.5 w-2/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mirrors McpConnectPage's tile row: horizontal offset, drop, tilt and scale
// per distance from the center tile.
const MCP_FAN_STEPS = [
  { x: 90, y: 0, rotate: 5, scale: 1 },
  { x: 158, y: 2, rotate: 10, scale: 0.97 },
  { x: 214, y: 10, rotate: 16, scale: 0.9 },
];

export function McpSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="w-full pb-4">
      {/* Hero: tile fan, title, subtitle */}
      <div className="flex flex-col items-center pt-10 sm:pt-16">
        <div className="relative h-[92px] w-full overflow-x-clip sm:h-[136px]">
          <div className="absolute left-1/2 top-0 h-[136px] w-[560px] -translate-x-1/2 origin-top scale-[0.68] sm:scale-100">
            {/* bg-app backings keep overlapping translucent tiles from stacking darker. */}
            {[-1, 1].flatMap((side) =>
              MCP_FAN_STEPS.map(({ x, y, rotate, scale }, i) => (
                <div
                  key={`${side}-${i}`}
                  className="absolute left-1/2 top-3 -ml-11 rounded-[22px] bg-app"
                  style={{ transform: `translate(${side * x}px, ${y}px) rotate(${side * rotate}deg) scale(${scale})`, zIndex: 30 - i * 10 }}
                >
                  <Skeleton className="h-[88px] w-[88px] rounded-[22px]" />
                </div>
              ))
            )}
            <div className="absolute left-1/2 top-0 z-40 -ml-14 rounded-[30px] bg-app">
              <Skeleton className="h-28 w-28 rounded-[30px]" />
            </div>
          </div>
        </div>
        <Skeleton className="mt-8 h-11 w-64 max-w-full rounded-2xl sm:mt-10 sm:h-14 sm:w-80 lg:h-16 lg:w-[22rem]" />
        <Skeleton className="mt-5 h-4 w-[28rem] max-w-full rounded-full" />
        <Skeleton className="mt-2.5 h-4 w-72 max-w-full rounded-full" />
      </div>

      {/* Setup panel: tinted shell, header row with tabs, three steps */}
      <div className="mx-auto mt-14 w-full max-w-6xl rounded-[30px] border border-hairline bg-(--app-fill) p-1.5 sm:mt-20">
        <div className="overflow-hidden rounded-[24px] border border-hairline bg-surface">
          <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-8">
            <Skeleton className="h-9 w-52 rounded-full" />
            <Skeleton className="hidden h-3 w-44 rounded-full sm:block" />
          </div>
          <div className="grid grid-cols-1 divide-y divide-hairline p-5 sm:p-8 lg:grid-cols-3 lg:divide-x lg:divide-y-0 lg:py-10">
            {["h-11 w-full rounded-xl", "h-11 w-52 rounded-full", "h-11 w-full rounded-xl"].map((action, i) => (
              <div key={i} className="flex flex-col py-8 first:pt-0 last:pb-0 lg:px-9 lg:py-0 lg:first:pl-0 lg:last:pr-0">
                <Skeleton className="h-7 w-9 rounded-md" />
                <Skeleton className="mt-6 h-4 w-48 rounded-full" />
                <Skeleton className="mt-4 h-3.5 w-full rounded-full" />
                <Skeleton className="mt-2 h-3.5 w-3/4 rounded-full" />
                <Skeleton className={`mt-8 ${action}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fallback for any /app route without a dedicated skeleton. */
export function GenericPageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6 pt-6 sm:pt-8">
      <div>
        <Skeleton className="h-8 w-56 max-w-full rounded-full" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full rounded-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-card" />
        ))}
      </div>
    </div>
  );
}
