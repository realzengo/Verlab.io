"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatCompactValue, formatDay, formatValue, niceTicks, type ValueFormat } from "./format";
import {
  AXIS_BAND,
  AXIS_GUTTER,
  AxisValuePill,
  ChartTooltip,
  GridY,
  nearestIndex,
  PLOT_TOP,
  SrTable,
  XLabels,
  type PlotBox,
} from "./parts";
import { useElementSize } from "./useElementWidth";
import { cn } from "@/lib/utils";

export interface TimeSeries {
  label: string;
  values: number[];
  /** A `var(--viz-*)` token. Defaults to the categorical slot for its position. */
  color?: string;
}

// Fixed categorical order -- validated with the dataviz six-checks script in
// both modes (see the `--viz-*` tokens in globals.css). Never cycled.
const SLOT_COLORS = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)"];

/**
 * Monotone cubic (Fritsch-Carlson) through the points: smooth like a product
 * dashboard's line, but it never overshoots a peak or dips below zero between
 * two flat days the way a Catmull-Rom curve does.
 */
function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) slopes.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x || 1));
  const tangents = new Array<number>(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangents[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      tangents[i] = tau * a * slopes[i];
      tangents[i + 1] = tau * b * slopes[i];
    }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3;
    d += `C${pts[i].x + dx},${pts[i].y + tangents[i] * dx} ${pts[i + 1].x - dx},${pts[i + 1].y - tangents[i + 1] * dx} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

/** How one day compares with the window's daily average. */
function averageNote(values: number[], i: number): string | undefined {
  const avg = values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);
  const v = values[i] ?? 0;
  if (avg <= 0 || v === 0) return undefined;
  const ratio = v / avg;
  if (ratio >= 1.05) return `${ratio.toFixed(1)}× the daily average`;
  if (ratio <= 0.95) return `${Math.round((1 - ratio) * 100)}% under the average`;
  return "Right on the average";
}

export function TimeSeriesChart({
  dates,
  series,
  format = "number",
  height = 220,
  variant = "area",
  axes = true,
  ariaLabel,
  yMax,
  fill = false,
}: {
  /** YYYY-MM-DD, one per point. */
  dates: string[];
  series: TimeSeries[];
  format?: ValueFormat;
  /** Plot height in px, not counting the x-axis row. */
  height?: number;
  variant?: "area" | "line";
  /** Off for small multiples: no ticks or date labels, just the mark. */
  axes?: boolean;
  ariaLabel: string;
  /** Shared ceiling, so small multiples compare on one scale. */
  yMax?: number;
  /** Grow taller than `height` to fill the panel when a neighbour in the
      row is taller; the panel body must be a flex column. */
  fill?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [ref, { width, height: boxHeight }] = useElementSize<HTMLDivElement>();
  const n = dates.length;
  // `at` is where the hover marks sit; they stay put (hidden) when the
  // pointer leaves, so the next hover glides from there. They start on today.
  const [hover, setHover] = useState<{ active: number | null; at: number }>({ active: null, at: Math.max(n - 1, 0) });
  const { active, at } = hover;
  const setActive = (next: number | null | ((cur: number | null) => number | null)) =>
    setHover((h) => {
      const value = typeof next === "function" ? next(h.active) : next;
      return { active: value, at: value ?? h.at };
    });

  const colored = series.map((s, i) => ({ ...s, color: s.color ?? SLOT_COLORS[i % SLOT_COLORS.length] }));
  const dataMax = Math.max(0, ...colored.flatMap((s) => s.values));
  const ticks = niceTicks(Math.max(yMax ?? 0, dataMax), axes ? 4 : 1);
  const top = ticks[ticks.length - 1] || 1;

  const chrome = axes ? PLOT_TOP + AXIS_BAND : 8;
  const minHeight = height + chrome;
  const plotHeight = fill && boxHeight > minHeight ? boxHeight - chrome : height;
  const box: PlotBox = {
    left: axes ? AXIS_GUTTER : 0,
    right: Math.max(width - (axes ? 2 : 0), 1),
    top: axes ? PLOT_TOP : 4,
    bottom: (axes ? PLOT_TOP : 4) + plotHeight,
  };
  const svgHeight = box.bottom + (axes ? AXIS_BAND : 4);
  const xFor = (i: number) => (n <= 1 ? (box.left + box.right) / 2 : box.left + (i / (n - 1)) * (box.right - box.left));
  const yFor = (v: number) => box.bottom - (v / top) * (box.bottom - box.top);

  const paths = colored.map((s) => {
    const pts = s.values.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
    const line = monotonePath(pts);
    const area = pts.length > 1 ? `${line}L${pts[pts.length - 1].x},${box.bottom}L${pts[0].x},${box.bottom}Z` : "";
    return { ...s, pts, line, area };
  });

  const onPointerMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (rect) setActive(nearestIndex(e.clientX - rect.left, box, n));
  };

  // Arrow keys walk the days so keyboard readers get the same readout as hover.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((cur) => {
      const from = cur ?? n - 1;
      return Math.max(0, Math.min(n - 1, from + (e.key === "ArrowLeft" ? -1 : 1)));
    });
  };

  const solo = paths.length === 1;
  const showEndDot = active === null && solo && n > 1;

  // Two or more series always get a legend, so identity never rides on color alone.
  const legend = paths.length > 1 && (
    <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-body">
      {paths.map((p) => (
        <li key={p.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-[2px] w-3 rounded-full" style={{ background: p.color }} />
          {p.label}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={cn("w-full", fill && "flex flex-1 flex-col")}>
      {legend}
      <div
        ref={ref}
        className={cn(
          "relative w-full outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-primary/40",
          fill && "flex-1"
        )}
        style={fill ? { minHeight } : { height: svgHeight }}
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((cur) => cur ?? n - 1)}
        onBlur={() => setActive(null)}
      >
        {width > 0 && n > 0 && (
          <svg width={width} height={svgHeight} className="absolute left-0 top-0 block overflow-visible" aria-hidden="true">
            <defs>
              {paths.map((p, i) => (
                <linearGradient key={p.label} id={`${id}-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: p.color, stopOpacity: solo ? 0.26 : 0.08 }} />
                  <stop offset="0.55" style={{ stopColor: p.color, stopOpacity: solo ? 0.07 : 0.02 }} />
                  <stop offset="1" style={{ stopColor: p.color, stopOpacity: 0 }} />
                </linearGradient>
              ))}
              {/* A lone series fades in from the left, so the eye lands on the
                  recent end. User-space units so a perfectly flat line
                  (zero-height box) still paints. */}
              {solo && (
                <>
                  <linearGradient
                    id={`${id}-stroke`}
                    gradientUnits="userSpaceOnUse"
                    x1={box.left}
                    y1="0"
                    x2={box.right}
                    y2="0"
                  >
                    <stop offset="0" style={{ stopColor: paths[0].color, stopOpacity: 0.35 }} />
                    <stop offset="0.6" style={{ stopColor: paths[0].color, stopOpacity: 1 }} />
                  </linearGradient>
                </>
              )}
            </defs>

            {axes ? (
              <GridY
                ticks={ticks}
                box={box}
                yFor={yFor}
                format={format}
                clearY={solo && active !== null ? Math.round(paths[0].pts[active].y) : null}
              />
            ) : (
              <line
                x1={box.left}
                x2={box.right}
                y1={box.bottom + 0.5}
                y2={box.bottom + 0.5}
                style={{ stroke: "var(--viz-baseline)" }}
              />
            )}

            {/* A thin marker standing at the latest day: where "now" is. */}
            {axes && n > 1 && (
              <line
                className="admin-late-in"
                x1={Math.round(xFor(n - 1)) + 0.5}
                x2={Math.round(xFor(n - 1)) + 0.5}
                y1={box.top}
                y2={box.bottom}
                style={{ stroke: "var(--viz-baseline)" }}
                strokeWidth={1}
              />
            )}

            {/* Each line draws itself left to right while its fill rises in
                behind it (globals.css, admin-line-draw / admin-area-in). */}
            {variant === "area" &&
              paths.map(
                (p, i) => p.area && <path key={`a-${p.label}`} className="admin-area-in" d={p.area} fill={`url(#${id}-fill-${i})`} />
              )}
            {paths.map((p) => (
              <path
                key={`l-${p.label}`}
                className="admin-line-draw"
                pathLength={1}
                d={p.line}
                fill="none"
                stroke={solo ? `url(#${id}-stroke)` : undefined}
                style={solo ? undefined : { stroke: p.color }}
                strokeWidth={solo ? 2.25 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {showEndDot && (
              <circle
                className="admin-chart-enddot"
                cx={paths[0].pts[n - 1].x}
                cy={paths[0].pts[n - 1].y}
                r={4}
                style={{ fill: paths[0].color, stroke: "var(--color-surface)" }}
                strokeWidth={2}
              />
            )}

            {/* The crosshair and its dots stay mounted and glide between days;
                leaving the plot just fades them. */}
            {n > 0 && (
              <g className="admin-glide pointer-events-none" style={{ opacity: active === null ? 0 : 1 }}>
                <line
                  className="admin-glide"
                  x1={0.5}
                  x2={0.5}
                  y1={box.top}
                  y2={box.bottom}
                  style={{ stroke: "var(--viz-crosshair)", transform: `translateX(${Math.round(xFor(at))}px)` }}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {paths.map((p) => (
                  <g
                    key={`d-${p.label}`}
                    className="admin-glide"
                    style={{ transform: `translate(${p.pts[at]?.x ?? 0}px, ${p.pts[at]?.y ?? 0}px)` }}
                  >
                    <circle r={9} style={{ fill: p.color, opacity: 0.16 }} />
                    <circle r={4.5} style={{ fill: p.color, stroke: "var(--color-surface)" }} strokeWidth={2} />
                  </g>
                ))}
              </g>
            )}

            {axes && solo && active !== null && (
              <AxisValuePill
                y={Math.round(paths[0].pts[active].y)}
                box={box}
                toX={paths[0].pts[active].x - 6}
                label={formatCompactValue(paths[0].values[active] ?? 0, format)}
              />
            )}

            {axes && <XLabels dates={dates} xFor={xFor} y={box.bottom + 18} width={box.right - box.left} />}

            {/* The hit area is the whole plot: readers aim at a day, never a 2px line. */}
            <rect
              x={box.left}
              y={box.top}
              width={Math.max(box.right - box.left, 0)}
              height={box.bottom - box.top}
              fill="transparent"
              onPointerMove={onPointerMove}
              onPointerLeave={() => setActive(null)}
            />
          </svg>
        )}

        {active !== null && width > 0 && (
          <ChartTooltip
            x={xFor(active)}
            top={box.top}
            containerWidth={width}
            title={active === n - 1 ? `${formatDay(dates[active])} · Today` : formatDay(dates[active])}
            note={solo ? averageNote(paths[0].values, active) : undefined}
            rows={paths.map((p) => ({
              label: paths.length > 1 ? p.label : undefined,
              value: formatValue(p.values[active] ?? 0, format),
              color: p.color,
            }))}
          />
        )}

        <SrTable caption={ariaLabel} dates={dates} series={series} format={format} />
      </div>
    </div>
  );
}
