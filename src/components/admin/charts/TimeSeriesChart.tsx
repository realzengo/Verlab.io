"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatDay, formatValue, niceTicks, type ValueFormat } from "./format";
import {
  AXIS_BAND,
  AXIS_GUTTER,
  ChartTooltip,
  GridY,
  nearestIndex,
  PLOT_TOP,
  SrTable,
  XLabels,
  type PlotBox,
} from "./parts";
import { useElementWidth } from "./useElementWidth";

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

export function TimeSeriesChart({
  dates,
  series,
  format = "number",
  height = 220,
  variant = "area",
  axes = true,
  ariaLabel,
  yMax,
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
}) {
  const id = useId().replace(/:/g, "");
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const colored = series.map((s, i) => ({ ...s, color: s.color ?? SLOT_COLORS[i % SLOT_COLORS.length] }));
  const n = dates.length;
  const dataMax = Math.max(0, ...colored.flatMap((s) => s.values));
  const ticks = niceTicks(Math.max(yMax ?? 0, dataMax), axes ? 4 : 1);
  const top = ticks[ticks.length - 1] || 1;

  const box: PlotBox = {
    left: axes ? AXIS_GUTTER : 0,
    right: Math.max(width - (axes ? 2 : 0), 1),
    top: axes ? PLOT_TOP : 4,
    bottom: (axes ? PLOT_TOP : 4) + height,
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

  const showEndDot = active === null && paths.length === 1 && n > 1;

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
    <div className="w-full">
      {legend}
      <div
        ref={ref}
        className="relative w-full outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-primary/40"
        style={{ height: svgHeight }}
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((cur) => cur ?? n - 1)}
        onBlur={() => setActive(null)}
      >
        {width > 0 && n > 0 && (
          <svg width={width} height={svgHeight} className="block overflow-visible" aria-hidden="true">
            <defs>
              {paths.map((p, i) => (
                <linearGradient key={p.label} id={`${id}-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: p.color, stopOpacity: paths.length > 1 ? 0.08 : 0.16 }} />
                  <stop offset="1" style={{ stopColor: p.color, stopOpacity: 0 }} />
                </linearGradient>
              ))}
            </defs>

            {axes ? (
              <GridY ticks={ticks} box={box} yFor={yFor} format={format} />
            ) : (
              <line
                x1={box.left}
                x2={box.right}
                y1={box.bottom + 0.5}
                y2={box.bottom + 0.5}
                style={{ stroke: "var(--viz-baseline)" }}
              />
            )}

            {/* One wipe reveals every line and its fill together (globals.css). */}
            <g className="admin-chart-draw">
              {variant === "area" &&
                paths.map((p, i) => p.area && <path key={`a-${p.label}`} d={p.area} fill={`url(#${id}-fill-${i})`} />)}
              {paths.map((p) => (
                <path
                  key={`l-${p.label}`}
                  d={p.line}
                  fill="none"
                  style={{ stroke: p.color }}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </g>

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

            {active !== null && (
              <g>
                <line
                  x1={Math.round(xFor(active)) + 0.5}
                  x2={Math.round(xFor(active)) + 0.5}
                  y1={box.top}
                  y2={box.bottom}
                  style={{ stroke: "var(--viz-crosshair)" }}
                  strokeWidth={1}
                />
                {paths.map((p) => (
                  <circle
                    key={`d-${p.label}`}
                    cx={p.pts[active].x}
                    cy={p.pts[active].y}
                    r={4}
                    style={{ fill: p.color, stroke: "var(--color-surface)" }}
                    strokeWidth={2}
                  />
                ))}
              </g>
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
            title={formatDay(dates[active])}
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
