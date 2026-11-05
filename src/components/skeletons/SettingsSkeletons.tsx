import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

// Loading screens for the settings tabs. The tab skeletons render inside
// settings/layout.tsx (which keeps its own header and tab bar on screen), so
// they cover the tab content only; SettingsShellSkeleton stands in for that
// layout when the whole settings segment is still loading. Shapes mirror
// components/settings/SettingsSection.tsx -- update both together.

/** Label + description on the left, a button on the right. */
function RowSkeleton({ labelWidth = "w-28", descriptionWidth = "w-56" }: { labelWidth?: string; descriptionWidth?: string }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className={cn("h-3.5 rounded-full", labelWidth)} />
        <Skeleton className={cn("h-3 max-w-full rounded-full", descriptionWidth)} />
      </div>
      <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
    </div>
  );
}

function SectionSkeleton({
  description = false,
  action = false,
  children,
}: {
  description?: boolean;
  action?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28 rounded-full" />
          {description && <Skeleton className="h-3.5 w-64 max-w-full rounded-full" />}
        </div>
        {action && <Skeleton className="h-8 w-28 shrink-0 rounded-lg" />}
      </div>
      <div className="mt-4 divide-y divide-hairline rounded-xl border border-hairline bg-surface">{children}</div>
    </div>
  );
}

export function SettingsShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#000000]">
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <Skeleton className="h-7 w-32 rounded-lg sm:h-8" />
        <div className="-mx-4 mt-5 flex gap-6 overflow-hidden border-b border-hairline px-4 sm:mx-0 sm:px-0">
          {["w-16", "w-24", "w-14", "w-16", "w-28"].map((width, i) => (
            <div key={i} className="flex h-10 shrink-0 items-center">
              <Skeleton className={cn("h-3.5 rounded-full", width)} />
            </div>
          ))}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

export function AccountSettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-10">
      <SectionSkeleton description>
        <div className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-32 rounded-full" />
            <Skeleton className="h-3.5 w-48 rounded-full" />
          </div>
        </div>
        <RowSkeleton labelWidth="w-20" />
        <RowSkeleton labelWidth="w-12" descriptionWidth="w-60" />
      </SectionSkeleton>

      <SectionSkeleton>
        <RowSkeleton descriptionWidth="w-32" />
        <RowSkeleton labelWidth="w-24" descriptionWidth="w-64" />
      </SectionSkeleton>

      <SectionSkeleton>
        <RowSkeleton labelWidth="w-16" descriptionWidth="w-52" />
        <RowSkeleton descriptionWidth="w-80" />
      </SectionSkeleton>
    </div>
  );
}

export function SubscriptionSettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <SectionSkeleton description>
        <RowSkeleton labelWidth="w-20" descriptionWidth="w-60" />
        <RowSkeleton labelWidth="w-36" descriptionWidth="w-72" />
      </SectionSkeleton>
    </div>
  );
}

export function CreditsSettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-10">
      <SectionSkeleton>
        <div className="flex items-end justify-between gap-6 px-5 py-5">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3.5 w-28 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-24 shrink-0 rounded-lg" />
        </div>
        <RowSkeleton labelWidth="w-24" descriptionWidth="w-12" />
      </SectionSkeleton>

      <SectionSkeleton description action>
        <div className="flex h-10 items-center justify-between px-5">
          <Skeleton className="h-2.5 w-14 rounded-full" />
          <Skeleton className="h-2.5 w-12 rounded-full" />
        </div>
        {["w-40", "w-32", "w-48", "w-36", "w-44"].map((width, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
            <Skeleton className={cn("h-3.5 rounded-full", width)} />
            <Skeleton className="hidden h-3.5 w-32 rounded-full sm:block" />
            <Skeleton className="h-3.5 w-12 rounded-full" />
          </div>
        ))}
      </SectionSkeleton>
    </div>
  );
}

export function SecuritySettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <SectionSkeleton description>
        <RowSkeleton labelWidth="w-20" descriptionWidth="w-72" />
      </SectionSkeleton>
    </div>
  );
}

export function ConnectedAppsSettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <SectionSkeleton description action>
        <div className="flex items-center gap-3 px-5 py-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <Skeleton className="h-8 w-24 shrink-0 rounded-lg" />
        </div>
      </SectionSkeleton>
    </div>
  );
}
