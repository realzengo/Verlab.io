"use client";

import { cn } from "@/lib/utils";

export interface SegmentItem {
  id: string;
  label: string;
  count?: number;
}

/**
 * Filters for a table: a quiet inset track with the selected option raised
 * onto the surface. Lighter than the app's pill Tabs, which are sized for
 * primary navigation rather than a filter above rows.
 */
export function SegmentedControl({
  items,
  active,
  onChange,
  label,
}: {
  items: SegmentItem[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[14px] bg-(--admin-fill) p-1 dark:bg-white/[0.045]">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 text-[13.5px] font-medium transition-colors",
              isActive
                ? "bg-surface text-heading shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_var(--color-hairline)] dark:bg-white/[0.09] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.05)]"
                : "text-subtle hover:text-heading"
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn("tabular-nums", isActive ? "text-subtle" : "text-subtle/80")}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
