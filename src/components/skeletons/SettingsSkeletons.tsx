import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

// Loading screens for the settings tabs. The tab skeletons render inside
// settings/layout.tsx (which keeps its own header and tab bar on screen), so
// they cover the tab content only; SettingsShellSkeleton stands in for that
// layout when the whole settings segment is still loading.

function SectionHeadingSkeleton({ first = false }: { first?: boolean }) {
  return <Skeleton className={cn("mb-6 h-6 w-32 rounded-full", first ? "mt-0" : "mt-10")} />;
}

/** Label + description on the left, action button on the right. */
function SettingsRowSkeleton() {
  return (
    <div className="flex flex-col justify-between border-b border-hairline py-4 last:border-0 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-3 w-64 max-w-full rounded-full" />
      </div>
      <Skeleton className="mt-3 h-8 w-20 shrink-0 rounded-md sm:mt-0" />
    </div>
  );
}

function SettingsRowsSkeleton({ count }: { count: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <SettingsRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function SettingsShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#000000]">
      <div className="w-full px-4 pt-6 pb-12 sm:px-6 sm:pt-10 sm:pb-16 md:px-8">
        <Skeleton className="mb-4 h-7 w-32 rounded-full sm:mb-6 sm:h-8" />
        <div className="mb-6 flex gap-4 overflow-hidden border-b border-hairline sm:mb-8 sm:gap-6">
          {["w-16", "w-24", "w-28", "w-36", "w-10"].map((width) => (
            <Skeleton key={width} className={cn("mb-2.5 h-4 shrink-0 rounded-full", width)} />
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export function AccountSettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mb-10 flex items-center gap-4">
        <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-4 w-48 rounded-full" />
        </div>
      </div>

      <SectionHeadingSkeleton />
      <SettingsRowsSkeleton count={2} />

      <SectionHeadingSkeleton />
      <SettingsRowsSkeleton count={2} />

      <SectionHeadingSkeleton />
      <SettingsRowsSkeleton count={1} />
    </div>
  );
}

export function SubscriptionSettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <SectionHeadingSkeleton first />
      <SettingsRowsSkeleton count={2} />
    </div>
  );
}

export function CreditsSettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <SectionHeadingSkeleton first />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-hairline bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-8 w-24 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="mt-10 mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48 rounded-full" />
          <Skeleton className="h-3.5 w-56 max-w-full rounded-full" />
        </div>
        <Skeleton className="h-8 w-24 shrink-0 rounded-lg" />
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline">
        {Array.from({ length: 6 }, (_, row) => (
          <div
            key={row}
            className={cn("grid grid-cols-4 gap-4 border-b border-hairline px-4 last:border-0", row === 0 ? "py-3.5" : "py-4")}
          >
            {[0, 1, 2, 3].map((col) => (
              <Skeleton key={col} className={cn("rounded-full", row === 0 ? "h-2.5 w-14" : "h-3.5 w-3/4")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SecuritySettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <SectionHeadingSkeleton first />
      <div className="border-b border-hairline py-4">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="mt-2 h-3 w-64 max-w-full rounded-full" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full rounded-md" />
      </div>
    </div>
  );
}

export function ConnectedAppsSettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="h-6 w-40 rounded-full" />
      <Skeleton className="mt-2 mb-6 h-4 w-80 max-w-full rounded-full" />
      <Skeleton className="h-[76px] w-full rounded-2xl" />
    </div>
  );
}
