import { cn } from "@/lib/utils";
import { axisLabelIndexes, formatCompactValue, formatDay, formatValue, type ValueFormat } from "./format";

// Shared anatomy for the admin's cartesian charts. Grid and axes are recessive
// solid hairlines in muted ink; the data is the only loud thing on the plot.

export const AXIS_GUTTER = 44; // room for "$12.5K" at 11px, right-aligned
export const AXIS_BAND = 26; // x-axis label row under the plot
export const PLOT_TOP = 10; // headroom so the top line, dot and its ring never clip

export interface PlotBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function GridY({
  ticks,
  box,
  yFor,
  format,
  labels = true,
  clearY,
}: {
  ticks: number[];
  box: PlotBox;
  yFor: (value: number) => number;
  format: ValueFormat;
  labels?: boolean;
  /** The hovered value's axis pill sits here; tick labels under it step aside. */
  clearY?: number | null;
}) {
  return (
    <g aria-hidden="true">
      {ticks.map((tick) => {
        const y = Math.round(yFor(tick)) + 0.5;
        return (
          <g key={tick}>
            <line
              x1={box.left}
              x2={box.right}
              y1={y}
              y2={y}
              style={{ stroke: tick === 0 ? "var(--viz-baseline)" : "var(--viz-grid)" }}
              strokeWidth={1}
            />
            {labels && (clearY == null || Math.abs(clearY - y) > 12) && (
              <text
                x={box.left - 10}
                y={y}
                dy="0.32em"
                textAnchor="end"
                className="tabular-nums"
                style={{ fill: "var(--viz-axis)", fontSize: 11 }}
              >
                {formatCompactValue(tick, format)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export function XLabels({
  dates,
  xFor,
  y,
  width,
  maxLabels,
}: {
  dates: string[];
  xFor: (index: number) => number;
  y: number;
  width: number;
  maxLabels?: number;
}) {
  // Roughly one label per 90px keeps "Nov 30" from ever touching its neighbor.
  const count = maxLabels ?? Math.max(2, Math.min(7, Math.floor(width / 90)));
  const indexes = axisLabelIndexes(dates.length, count);
  return (
    <g aria-hidden="true">
      {indexes.map((i, n) => {
        const last = n === indexes.length - 1 && indexes.length > 1;
        const anchor = n === 0 && indexes.length > 1 ? "start" : last ? "end" : "middle";
        if (!last) {
          return (
            <text key={dates[i]} x={xFor(i)} y={y} textAnchor={anchor} style={{ fill: "var(--viz-axis)", fontSize: 11 }}>
              {formatDay(dates[i])}
            </text>
          );
        }
        // The most recent day sits in a small pill: where "now" is on the axis.
        const label = formatDay(dates[i]);
        const w = label.length * 6.2 + 14;
        return (
          <g key={dates[i]}>
            <rect x={xFor(i) - w + 4} y={y - 12} width={w} height={18} rx={9} style={{ fill: "var(--admin-fill-strong)" }} />
            <text x={xFor(i) - 3} y={y} textAnchor="end" style={{ fill: "var(--color-heading)", fontSize: 11, fontWeight: 500 }}>
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export interface TooltipRow {
  label?: string;
  value: string;
  color: string;
  /** Line key for lines/areas, square for bars -- mirrors the mark. */
  key?: "line" | "square";
}

/**
 * One tooltip for every series at the hovered x. Values lead in strong ink;
 * the series name follows in muted ink; a short stroke of the series color
 * keys each row. It sits beside the crosshair and flips sides past 60% so it
 * never runs off the card.
 */
export function ChartTooltip({
  x,
  top,
  containerWidth,
  title,
  rows,
  note,
  centered = false,
}: {
  x: number;
  top: number;
  containerWidth: number;
  title: string;
  rows: TooltipRow[];
  /** A line of context under the values, e.g. "2.4× the daily average". */
  note?: string;
  /** Sit on the plot's middle instead of its top: small charts inside a
      clipped frame, where a top-hung tooltip would run off the bottom. */
  centered?: boolean;
}) {
  const flip = x > containerWidth * 0.6;
  const tx = flip ? `calc(${x}px - 100% - 12px)` : `${x + 12}px`;
  return (
    // Placed by transform rather than `left`, so moving between days glides.
    <div
      role="presentation"
      className="admin-chart-tooltip admin-glide pointer-events-none absolute left-0 z-20 min-w-[148px] whitespace-nowrap rounded-[12px] bg-(--admin-tooltip-bg) px-3 py-2.5 text-(--admin-tooltip-fg) shadow-[0_0_0_1px_var(--admin-tooltip-ring),0_12px_32px_-8px_rgba(10,10,30,0.45)]"
      style={
        centered
          ? { top: "50%", minWidth: 0, transform: `translate(${tx}, -50%)` }
          : { top, transform: `translateX(${flip ? `calc(${x}px - 100% - 16px)` : `${x + 16}px`})` }
      }
    >
      <p className="text-[11px] font-medium text-(--admin-tooltip-muted)">{title}</p>
      <div className="mt-1.5 flex flex-col gap-1">
        {rows.map((row, i) => (
          <div key={row.label ?? i} className="flex items-center gap-2 text-[13px]">
            <span
              aria-hidden="true"
              className={cn("shrink-0", row.key === "square" ? "h-2 w-2 rounded-[2px]" : "h-2 w-2 rounded-full")}
              style={{ background: row.color }}
            />
            <span className="font-semibold tabular-nums">{row.value}</span>
            {row.label && <span className="ml-auto pl-3 text-(--admin-tooltip-muted)">{row.label}</span>}
          </div>
        ))}
      </div>
      {note && <p className="mt-2 border-t border-white/10 pt-2 text-[11.5px] text-(--admin-tooltip-muted)">{note}</p>}
    </div>
  );
}

/**
 * The hovered value pinned to the y axis: a small ink pill in the gutter and
 * a dashed guide running across to the mark.
 */
export function AxisValuePill({ y, box, toX, label }: { y: number; box: PlotBox; toX: number; label: string }) {
  const w = Math.max(28, label.length * 6.4 + 12);
  return (
    <g className="admin-glide pointer-events-none" style={{ transform: `translateY(${y}px)` }} aria-hidden="true">
      <line x1={box.left} x2={toX} y1={0.5} y2={0.5} style={{ stroke: "var(--viz-crosshair)" }} strokeWidth={1} strokeDasharray="3 3" />
      <rect x={box.left - w - 6} y={-9} width={w} height={18} rx={9} style={{ fill: "var(--admin-tooltip-bg)" }} />
      <text
        x={box.left - 6 - w / 2}
        y={0}
        dy="0.34em"
        textAnchor="middle"
        className="tabular-nums"
        style={{ fill: "var(--admin-tooltip-fg)", fontSize: 10.5, fontWeight: 600 }}
      >
        {label}
      </text>
    </g>
  );
}

/** The table twin every chart carries, so no value is gated behind hover or color. */
export function SrTable({
  caption,
  dates,
  series,
  format,
}: {
  caption: string;
  dates: string[];
  series: { label: string; values: number[] }[];
  format: ValueFormat;
}) {
  // The wrapper does the hiding: a table ignores its own overflow clip, so an
  // sr-only <table> still adds its rows' height to the page's scroll.
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {series.map((s) => (
              <th key={s.label} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date, i) => (
            <tr key={date}>
              <th scope="row">{formatDay(date)}</th>
              {series.map((s) => (
                <td key={s.label}>{formatValue(s.values[i] ?? 0, format)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Index of the data point nearest a pointer x, for crosshair snapping. */
export function nearestIndex(pointerX: number, box: PlotBox, length: number): number {
  if (length <= 1) return 0;
  const t = (pointerX - box.left) / (box.right - box.left);
  return Math.max(0, Math.min(length - 1, Math.round(t * (length - 1))));
}
