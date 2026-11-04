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
}: {
  ticks: number[];
  box: PlotBox;
  yFor: (value: number) => number;
  format: ValueFormat;
  labels?: boolean;
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
            {labels && (
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
      {indexes.map((i, n) => (
        <text
          key={dates[i]}
          x={xFor(i)}
          y={y}
          textAnchor={n === 0 && indexes.length > 1 ? "start" : n === indexes.length - 1 && indexes.length > 1 ? "end" : "middle"}
          style={{ fill: "var(--viz-axis)", fontSize: 11 }}
        >
          {formatDay(dates[i])}
        </text>
      ))}
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
}: {
  x: number;
  top: number;
  containerWidth: number;
  title: string;
  rows: TooltipRow[];
}) {
  const flip = x > containerWidth * 0.6;
  return (
    <div
      role="presentation"
      className="admin-chart-tooltip pointer-events-none absolute z-20 min-w-[132px] whitespace-nowrap rounded-lg border border-hairline bg-surface px-3 py-2 shadow-card-hover"
      style={{ left: x, top, transform: flip ? "translateX(calc(-100% - 14px))" : "translateX(14px)" }}
    >
      <p className="text-[11px] font-medium text-subtle">{title}</p>
      <div className="mt-1.5 flex flex-col gap-1">
        {rows.map((row, i) => (
          <div key={row.label ?? i} className="flex items-center gap-2 text-[13px]">
            <span
              aria-hidden="true"
              className={cn("shrink-0", row.key === "square" ? "h-2 w-2 rounded-[2px]" : "h-[2px] w-3 rounded-full")}
              style={{ background: row.color }}
            />
            <span className="font-semibold tabular-nums text-heading">{row.value}</span>
            {row.label && <span className="ml-auto pl-3 text-subtle">{row.label}</span>}
          </div>
        ))}
      </div>
    </div>
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
  return (
    <table className="sr-only">
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
  );
}

/** Index of the data point nearest a pointer x, for crosshair snapping. */
export function nearestIndex(pointerX: number, box: PlotBox, length: number): number {
  if (length <= 1) return 0;
  const t = (pointerX - box.left) / (box.right - box.left);
  return Math.max(0, Math.min(length - 1, Math.round(t * (length - 1))));
}
