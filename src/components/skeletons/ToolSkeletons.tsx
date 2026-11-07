import { Skeleton } from "@/components/ui/Skeleton";

// Route-level loading screens for the tool pages. Each one mirrors its
// page's real wrappers and panel shapes so the content swaps in without the
// layout jumping -- if a tool's layout changes, update its skeleton too.

/** The gradient h1 + one-line subtitle most tool pages open with. */
function PageTitleSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-60 max-w-full rounded-full sm:h-10 sm:w-72" />
      <Skeleton className="mt-3 h-3.5 w-48 max-w-full rounded-full sm:h-4 sm:w-60" />
    </div>
  );
}

/** Two short lines standing in for an empty prompt textarea. */
function PromptLinesSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 pt-1">
      <Skeleton className="h-3.5 w-2/3 rounded-full" />
      <Skeleton className="h-3.5 w-1/2 rounded-full" />
    </div>
  );
}

export function BendSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="pt-2">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-16 pt-2">
        {/* Stepper pill */}
        <div className="flex justify-center">
          <Skeleton className="h-10 w-80 max-w-full rounded-full" />
        </div>

        {/* Hero: the tile trio, title, subtitle, then the link composer */}
        <div className="flex flex-col items-center pt-8 sm:pt-12">
          <div className="flex items-center">
            <Skeleton className="h-[88px] w-[88px] -rotate-6 rounded-[22px]" />
            <Skeleton className="relative z-10 -mx-5 h-28 w-28 rounded-[30px]" />
            <Skeleton className="h-[88px] w-[88px] rotate-6 rounded-[22px]" />
          </div>
          <Skeleton className="mt-10 h-12 w-72 max-w-full rounded-2xl sm:h-16 sm:w-96" />
          <Skeleton className="mt-5 h-4 w-96 max-w-full rounded-full" />
          <Skeleton className="mt-2.5 h-4 w-72 max-w-full rounded-full" />
          <Skeleton className="mt-12 h-[80px] w-full max-w-2xl rounded-[22px]" />
        </div>

        {/* Recent bends */}
        <div className="mx-auto mt-8 w-full max-w-4xl rounded-[30px] border border-hairline p-1.5">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-4 sm:px-6">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-3 w-14 rounded-full" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-hairline px-5 py-3.5 last:border-0 sm:px-6">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40 rounded-full" />
                <Skeleton className="h-3 w-56 max-w-full rounded-full" />
              </div>
              <Skeleton className="hidden h-3 w-20 rounded-full sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DownloaderSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex w-full flex-col pb-16">
      {/* Hero: ink title, one-line subtitle */}
      <div className="flex flex-col items-center pt-10 sm:pt-16">
        <Skeleton className="h-10 w-72 max-w-full rounded-xl sm:h-16 sm:w-[30rem]" />
        <Skeleton className="mt-5 h-4 w-80 max-w-full rounded-full" />
        <Skeleton className="mt-2 h-4 w-56 max-w-full rounded-full" />
      </div>

      {/* Bezel link field and the status line under it */}
      <div className="mx-auto mt-10 w-full max-w-2xl sm:mt-12">
        <div className="rounded-[22px] border border-hairline p-1.5">
          <Skeleton className="h-[66px] w-full rounded-2xl" />
        </div>
        <div className="mt-4 flex h-6 justify-center">
          <Skeleton className="h-4 w-72 max-w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ImageGeneratorSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="pt-2">
      <div className="w-full px-0 pt-8 pb-20 sm:px-6 sm:pt-12">
        <div className="mx-auto w-full max-w-4xl md:max-w-[960px]">
          <PageTitleSkeleton />

          {/* Mobile: Generate/History toggle + stacked setting sections */}
          <div className="mt-6 md:hidden">
            <Skeleton className="h-10 w-full rounded-full" />
            <div className="mt-6 flex flex-col gap-4">
              {["h-[140px]", "h-16", "h-16"].map((height, i) => (
                <div key={i} className="rounded-3xl border border-hairline bg-surface p-5">
                  <Skeleton className="h-3 w-20 rounded-full" />
                  <Skeleton className={`mt-3 w-full rounded-2xl ${height}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Desktop: prompt composer */}
          <div className="mt-8 hidden rounded-[28px] border border-hairline bg-surface px-9 py-5 shadow-card md:block">
            <div className="min-h-[96px]">
              <PromptLinesSkeleton />
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {["w-32", "w-20", "w-28", "w-24"].map((width) => (
                <Skeleton key={width} className={`h-8 rounded-full ${width}`} />
              ))}
              <Skeleton className="ml-auto h-10 w-36 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Desktop: Recent Generations */}
        <div className="mt-22 hidden md:block">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-4 w-36 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Recent Generations mixes portrait and landscape clips, so the masonry
// placeholder alternates both instead of a uniform grid.
const VIDEO_TILE_ASPECTS = ["aspect-[9/16]", "aspect-video", "aspect-video", "aspect-[9/16]", "aspect-video", "aspect-[9/16]"];

export function VideoGeneratorSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="pt-2">
      <div className="w-full px-0 pt-8 pb-20 sm:px-6 sm:pt-12">
        <div className="mx-auto w-full max-w-6xl">
          <PageTitleSkeleton />

          {/* Generate/History toggle -- mobile only */}
          <Skeleton className="mt-6 h-11 w-full rounded-2xl lg:hidden" />

          <div className="mt-4 flex flex-col gap-4 lg:mt-6 lg:flex-row lg:items-start">
            {/* Mode rail -- desktop */}
            <div className="hidden shrink-0 flex-col gap-1 rounded-2xl border border-hairline bg-surface p-1.5 lg:flex">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 px-4 py-2">
                  <Skeleton className="h-4 w-4 rounded-md" />
                  <Skeleton className="h-2.5 w-9 rounded-full" />
                </div>
              ))}
            </div>

            {/* Mode tabs -- mobile */}
            <Skeleton className="h-11 w-full rounded-2xl lg:hidden" />

            {/* Composer */}
            <div className="flex min-h-[180px] min-w-0 flex-1 flex-col gap-4 rounded-[2rem] border border-hairline bg-surface p-5 shadow-sm">
              <div className="flex flex-1 items-start gap-3">
                <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
                <div className="flex-1">
                  <PromptLinesSkeleton />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {["w-28", "w-20", "w-24"].map((width) => (
                  <Skeleton key={width} className={`h-8 rounded-full ${width}`} />
                ))}
                <Skeleton className="ml-auto h-10 w-36 rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Generations -- desktop */}
        <div className="mt-10 hidden w-full px-4 sm:px-8 lg:block">
          <Skeleton className="mb-4 h-4 w-36 rounded-full" />
          <div className="columns-4 gap-4 xl:columns-5 2xl:columns-6">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton
                key={i}
                className={`mb-4 w-full break-inside-avoid rounded-2xl ${VIDEO_TILE_ASPECTS[i % VIDEO_TILE_ASPECTS.length]}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const VOICEOVER_PANEL = "rounded-2xl border border-hairline bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:shadow-none";

export function VoiceoverSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="pt-2">
      <div className="w-full px-0 pt-8 pb-16 sm:px-6 sm:pt-10">
        <div className="mx-auto w-full max-w-7xl">
          <header className="mb-6">
            <Skeleton className="h-7 w-56 rounded-full sm:h-8" />
            <Skeleton className="mt-2.5 h-4 w-72 max-w-full rounded-full" />
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Script workspace */}
            <div className={`${VOICEOVER_PANEL} flex min-h-[600px] flex-col overflow-hidden`}>
              <div className="flex flex-1 flex-col px-5 pt-5">
                <Skeleton className="h-6 w-48 rounded-full" />
                <div className="mt-6 flex flex-col gap-3">
                  <Skeleton className="h-3.5 w-full rounded-full" />
                  <Skeleton className="h-3.5 w-11/12 rounded-full" />
                  <Skeleton className="h-3.5 w-4/5 rounded-full" />
                  <Skeleton className="h-3.5 w-2/3 rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-hairline py-3 pl-5 pr-3">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="h-9 w-28 rounded-lg" />
              </div>
            </div>

            {/* Settings sidebar */}
            <div className={`${VOICEOVER_PANEL} flex flex-col overflow-hidden`}>
              <div className="flex gap-5 border-b border-hairline px-5 pt-4">
                <Skeleton className="mb-3 h-4 w-16 rounded-full" />
                <Skeleton className="mb-3 h-4 w-14 rounded-full" />
              </div>
              <div className="p-5">
                <Skeleton className="h-3 w-12 rounded-full" />
                <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-hairline p-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-28 rounded-full" />
                    <Skeleton className="h-3 w-20 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="border-t border-hairline p-5">
                <Skeleton className="h-3 w-12 rounded-full" />
                <Skeleton className="mt-2.5 h-10 w-full rounded-lg" />
                <Skeleton className="mt-3 h-3 w-4/5 rounded-full" />
              </div>
              <div className="flex flex-col gap-5 border-t border-hairline p-5">
                {[0, 1, 2].map((i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-20 rounded-full" />
                      <Skeleton className="h-3 w-8 rounded-full" />
                    </div>
                    <Skeleton className="mt-3 h-1 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScriptsSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mx-auto w-full max-w-3xl pt-8 sm:pt-12">
        <PageTitleSkeleton />

        {/* Prompter: textarea + transcript/file drop zones */}
        <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-hairline bg-surface p-5 shadow-sm md:flex-row">
          <div className="min-h-[150px] flex-1">
            <PromptLinesSkeleton />
          </div>
          <div className="hidden w-px self-stretch bg-hairline md:block" />
          <div className="flex w-full flex-col gap-3 md:w-[280px]">
            <div className="flex gap-3">
              <Skeleton className="aspect-square min-w-0 flex-1 rounded-2xl" />
              <Skeleton className="aspect-square min-w-0 flex-1 rounded-2xl" />
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* History */}
      <div className="mt-12 w-full px-4 md:px-8">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-5 w-32 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-11 w-full rounded-xl" />
        <div className="mt-4 rounded-2xl border border-hairline bg-(--app-fill) p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-card" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TranscriptsSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex w-full flex-col pb-16">
      {/* Hero: ink title, one-line subtitle */}
      <div className="flex flex-col items-center pt-10 sm:pt-16">
        <Skeleton className="h-11 w-64 rounded-xl sm:h-16 sm:w-96" />
        <Skeleton className="mt-5 h-4 w-80 max-w-full rounded-full" />
        <Skeleton className="mt-2 h-4 w-56 max-w-full rounded-full" />
      </div>

      {/* Bezel link field and the status line under it */}
      <div className="mx-auto mt-10 w-full max-w-2xl sm:mt-12">
        <div className="rounded-[22px] border border-hairline p-1.5">
          <Skeleton className="h-[66px] w-full rounded-2xl" />
        </div>
        <div className="mt-4 flex h-6 justify-center">
          <Skeleton className="h-4 w-72 max-w-full rounded-full" />
        </div>
      </div>

      {/* History */}
      <div className="mt-14 flex flex-col gap-4 sm:mt-20">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
          <div className="h-10 border-b border-hairline" />
          <div className="divide-y divide-hairline">
            {["w-3/5", "w-2/5", "w-1/2", "w-1/3"].map((width) => (
              <div key={width} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-4 shrink-0 rounded-[5px]" />
                <Skeleton className="h-14 w-8 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className={`h-3.5 ${width} rounded-full`} />
                  <Skeleton className="h-3 w-20 rounded-full" />
                </div>
                <Skeleton className="hidden h-3 w-24 rounded-full sm:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClippingSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex w-full flex-col pb-20">
      {/* Hero: two-line ink title */}
      <div className="flex flex-col items-center pt-10 sm:pt-28">
        <Skeleton className="h-10 w-72 max-w-full rounded-xl sm:h-14 sm:w-[520px]" />
        <Skeleton className="mt-3 h-10 w-56 max-w-full rounded-xl sm:h-14 sm:w-80" />
      </div>

      {/* Bezel link field and the status line under it */}
      <div className="mx-auto mt-8 w-full max-w-2xl sm:mt-12">
        <div className="rounded-[22px] border border-hairline p-1.5">
          <Skeleton className="h-[66px] w-full rounded-2xl" />
        </div>
        <div className="mt-4 flex h-6 justify-center">
          <Skeleton className="h-4 w-64 max-w-full rounded-full" />
        </div>
      </div>

      {/* "Or choose": heading, search, category pills, video grid */}
      <div className="mx-auto mt-16 flex w-full max-w-5xl flex-col items-center sm:mt-24">
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="mt-3 h-3.5 w-44 rounded-full" />
        <Skeleton className="mt-5 h-12 w-full max-w-md rounded-full sm:mt-6 sm:h-11" />
        {/* one row on phones (it scrolls), wrapped from sm up */}
        <div className="-mx-4 mt-4 flex gap-2 self-stretch overflow-hidden px-4 sm:mx-0 sm:flex-wrap sm:justify-center sm:self-auto sm:px-0">
          {["w-28", "w-20", "w-28", "w-16", "w-16", "w-14"].map((width, index) => (
            <Skeleton key={index} className={`h-9 shrink-0 sm:h-8 ${width} rounded-full`} />
          ))}
        </div>
        <div className="mt-6 grid w-full grid-cols-1 gap-x-5 gap-y-7 sm:mt-8 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex flex-col">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <div className="mt-3 flex gap-2.5">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2 pt-0.5">
                  <Skeleton className="h-3.5 w-11/12 rounded-full" />
                  <Skeleton className="h-3 w-1/2 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
