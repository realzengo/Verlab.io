"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatValue, type ValueFormat } from "./format";
import type { DetailSpec } from "@/components/admin/details";
import { DetailDialog } from "@/components/admin/DetailDialog";

export interface BarListItem {
  label: string;
  value: number;
  /** A small mono tag after the label, e.g. an HTTP method. */
  tag?: string;
  /** What clicking the row shows. Rows without one aren't clickable. */
  detail?: DetailSpec;
}

/**
 * A ranked list: a mono rank, the label over a thin track that carries its
 * length, the value at the end. The tracks are neutral steps and only the
 * leader takes the accent, so the eye lands on what ranks first. Rows with a
 * `detail` open it in a dialog.
 */
export function BarList({
  items,
  format = "number",
  showShare = true,
  emptyLabel = "No data yet",
  fill = false,
}: {
  items: BarListItem[];
  format?: ValueFormat;
  /** Each row's share of the list total, after the value. */
  showShare?: boolean;
  emptyLabel?: string;
  /** Spread the rows over the panel's height when a neighbour in the row is
      taller, instead of leaving a gap under the list; the panel body must be
      a flex column. */
  fill?: boolean;
}) {
  const [open, setOpen] = useState<DetailSpec | null>(null);
  const max = Math.max(0, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);

  if (items.length === 0 || total === 0) {
    // Centered in whatever room the panel has, so an empty panel beside a
    // full one reads as "nothing yet", not as a layout gap.
    return <p className="flex min-h-24 flex-1 items-center justify-center py-6 text-center text-[13px] text-subtle">{emptyLabel}</p>;
  }

  return (
    <>
      <ol className={cn("-mx-2 flex flex-col", fill && "flex-1 justify-between")}>
        {items.map((item, index) => {
          const pct = max > 0 ? (item.value / max) * 100 : 0;
          const clickable = Boolean(item.detail);
          const body = (
            <>
              <span className="pt-px font-mono text-[11px] tabular-nums text-subtle">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13.5px] text-heading">{item.label}</span>
                  {item.tag && (
                    <span className="shrink-0 rounded-[5px] bg-(--admin-fill-strong) px-1 py-px font-mono text-[10.5px] font-medium text-subtle">
                      {item.tag}
                    </span>
                  )}
                </span>
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-(--admin-fill-strong)">
                  {item.value > 0 && (
                    <span
                      className="admin-grow-x block h-full rounded-full"
                      style={{
                        width: `max(${pct}%, 4px)`,
                        background: index === 0 ? "var(--viz-1)" : "var(--viz-neutral)",
                        animationDelay: `${Math.min(index * 50, 400)}ms`,
                      }}
                    />
                  )}
                </span>
              </span>
              <span className="flex items-center gap-2 self-start text-[13px] tabular-nums">
                <span className="font-medium text-heading">{formatValue(item.value, format)}</span>
                {showShare && (
                  <span className="w-9 text-right text-[12px] text-subtle">{Math.round((item.value / total) * 100)}%</span>
                )}
                {clickable && (
                  <ChevronRight
                    className="-mr-1 h-3.5 w-3.5 text-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    aria-hidden="true"
                  />
                )}
              </span>
            </>
          );
          const rowClass = "grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-x-3 rounded-lg px-2 py-2.5 text-left";
          return (
            <li key={`${index}-${item.label}`}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => setOpen(item.detail!)}
                  aria-label={`${item.label}${item.tag ? ` ${item.tag}` : ""}: ${formatValue(item.value, format)}, show details`}
                  className={cn(
                    rowClass,
                    "group cursor-pointer outline-none transition-colors hover:bg-(--admin-fill) focus-visible:bg-(--admin-fill) focus-visible:ring-2 focus-visible:ring-primary/30"
                  )}
                >
                  {body}
                </button>
              ) : (
                <div className={rowClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
      <DetailDialog spec={open} onClose={() => setOpen(null)} />
    </>
  );
}
