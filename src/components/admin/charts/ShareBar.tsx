"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
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
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const visible = segments.filter((s) => s.value > 0);

  return (
    <div>
      <div
        className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={
          total > 0
            ? segments.map((s) => `${s.label}: ${formatValue(s.value, format)}`).join(", ")
            : emptyLabel
        }
      >
        {total === 0 ? (
          <div className="h-full w-full bg-(--admin-fill)" />
        ) : (
          visible.map((seg) => (
            <div
              key={seg.label}
              className="h-full transition-opacity duration-150"
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

      <ul className="mt-4 flex flex-col">
        {segments.map((seg) => (
          <li
            key={seg.label}
            className={cn(
              "-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
              hover === seg.label && "bg-(--admin-fill)"
            )}
            onPointerEnter={() => setHover(seg.label)}
            onPointerLeave={() => setHover(null)}
          >
            {seg.icon ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center" style={{ color: seg.color }}>
                {seg.icon}
              </span>
            ) : (
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: seg.color }} />
            )}
            <span className="min-w-0 truncate text-body">
              {seg.label}
              {seg.detail && <span className="text-subtle"> · {seg.detail}</span>}
            </span>
            <span className="ml-auto font-medium tabular-nums text-heading">{formatValue(seg.value, format)}</span>
            <span className="w-10 text-right text-[12px] tabular-nums text-subtle">
              {total > 0 ? `${Math.round((seg.value / total) * 100)}%` : "0%"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
