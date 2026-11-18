"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DetailSpec } from "@/components/admin/details";
import { DetailDialog } from "@/components/admin/DetailDialog";
import { formatValue, type ValueFormat } from "./format";

export interface ShareSegment {
  label: string;
  value: number;
  /** A `var(--viz-*)` token: an ordinal tier step, a status color, or a categorical slot. */
  color: string;
  /** Status segments carry an icon so state never rides on color alone. */
  icon?: ReactNode;
  /** Secondary detail after the label, e.g. "3 subscribers". */
  detail?: string;
  /** What clicking the legend row shows. */
  info?: DetailSpec;
}

/**
 * Part-to-whole in one line: a stacked bar with a 2px surface gap between
 * segments, then a legend row per segment holding the value and share. The
 * legend carries every number, so hovering either side only highlights.
 */
export function ShareBar({
  segments,
  format = "number",
  emptyLabel = "No data yet",
}: {
  segments: ShareSegment[];
  format?: ValueFormat;
  emptyLabel?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<DetailSpec | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const visible = segments.filter((s) => s.value > 0);

  return (
    <div>
      <div
        className="admin-grow-x flex h-3 w-full gap-[3px] overflow-hidden rounded-full"
        role="img"
        aria-label={
          total > 0
            ? segments.map((s) => `${s.label}: ${formatValue(s.value, format)}`).join(", ")
            : emptyLabel
        }
      >
        {total === 0 ? (
          <div className="h-full w-full bg-(--admin-fill-strong)" />
        ) : (
          visible.map((seg) => (
            <div
              key={seg.label}
              className="h-full rounded-[3px] transition-opacity duration-150 first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(seg.value / total) * 100}%`,
                background: seg.color,
                opacity: hover === null || hover === seg.label ? 1 : 0.35,
              }}
              onPointerEnter={() => setHover(seg.label)}
              onPointerLeave={() => setHover(null)}
            />
          ))
        )}
      </div>

      <ul className="-mx-2 mt-4 flex flex-col">
        {segments.map((seg) => {
          const body = (
            <>
              {seg.icon ? (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center" style={{ color: seg.color }}>
                  {seg.icon}
                </span>
              ) : (
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: seg.color }} />
              )}
              <span className="min-w-0 truncate text-[13.5px] text-heading">
                {seg.label}
                {seg.detail && <span className="text-subtle"> · {seg.detail}</span>}
              </span>
              <span className="ml-auto font-medium tabular-nums text-heading">{formatValue(seg.value, format)}</span>
              <span className="w-10 text-right text-[12px] tabular-nums text-subtle">
                {total > 0 ? `${Math.round((seg.value / total) * 100)}%` : "0%"}
              </span>
              {seg.info && (
                <ChevronRight
                  className="-mr-1 h-3.5 w-3.5 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden="true"
                />
              )}
            </>
          );
          const rowClass = cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] transition-colors",
            hover === seg.label && "bg-(--admin-fill)"
          );
          return (
            <li key={seg.label} onPointerEnter={() => setHover(seg.label)} onPointerLeave={() => setHover(null)}>
              {seg.info ? (
                <button
                  type="button"
                  onClick={() => setOpen(seg.info!)}
                  aria-label={`${seg.label}: ${formatValue(seg.value, format)}, show details`}
                  className={cn(rowClass, "group cursor-pointer outline-none focus-visible:bg-(--admin-fill) focus-visible:ring-2 focus-visible:ring-primary/30")}
                >
                  {body}
                </button>
              ) : (
                <div className={rowClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      <DetailDialog spec={open} onClose={() => setOpen(null)} />
    </div>
  );
}
