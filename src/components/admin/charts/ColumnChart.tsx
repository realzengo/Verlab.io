"use client";

import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { formatCompactValue, formatDay, formatValue, niceTicks, type ValueFormat } from "./format";
import { AXIS_BAND, AXIS_GUTTER, AxisValuePill, ChartTooltip, GridY, PLOT_TOP, SrTable, XLabels, type PlotBox } from "./parts";
import { useElementSize } from "./useElementWidth";

const MAX_BAR = 22;
const RADIUS = 4;

/** A column with a rounded data end and a square foot on the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Daily columns, one series. Every day sits in a solid lighter step of the
 * accent and the day in focus takes the full accent: today at rest, the
 * pointed-at day on hover, with a highlight column, an axis pill and the
 * tooltip gliding over from the last one. A dotted line marks the average.
 *
 * `axes={false}` is the small-multiple form: no ticks, labels or average, a
 * fixed `yMax` shared across tiles, and a tooltip that stays inside the tile.
 */
export function ColumnChart({
  dates,
  values,
  label,
  format = "number",
  height = 200,
  color = "var(--viz-1)",
  restColor = "var(--viz-1-rest)",
  ariaLabel,
  showAverage = true,
  axes = true,
  yMax,
  fill = false,
}: {
  dates: string[];
  values: number[];
  /** Series name, for the table twin. */
  label: string;
  format?: ValueFormat;
  /** Plot height in px, not counting the x-axis row. */
  height?: number;
  /** The day in focus. */
  color?: string;
  /** Every other day: a solid step of the same hue, never a see-through tint. */
  restColor?: string;
  ariaLabel: string;
  showAverage?: boolean;
  /** Off for small multiples: no ticks, date labels or average, just the mark. */
  axes?: boolean;
  /** Shared ceiling, so small multiples compare on one scale. */
  yMax?: number;
  /** Grow taller than `height` to fill the panel when a neighbour in the
      row is taller; the panel body must be a flex column. */
  fill?: boolean;
}) {
  const [ref, { width, height: boxHeight }] = useElementSize<HTMLDivElement>();
  const n = values.length;
  // `at` is where the hover marks sit; they stay put (hidden) when the
  // pointer leaves, so the next hover glides from there. They start on today.
  const [hover, setHover] = useState<{ active: number | null; at: number }>({ active: null, at: Math.max(n - 1, 0) });
  const { active, at } = hover;
  const setActive = (next: number | null | ((cur: number | null) => number | null)) =>
    setHover((h) => {
      const value = typeof next === "function" ? next(h.active) : next;
      return { active: value, at: value ?? h.at };
    });

  const last = n - 1;
  const dataMax = Math.max(yMax ?? 0, 0, ...values);
  const ticks = niceTicks(dataMax);
  // Small multiples run to the shared peak itself, so the busiest tile's
  // tallest day fills its plot; full charts round up to a clean tick.
  const top = (axes ? ticks[ticks.length - 1] : dataMax) || 1;
  const avg = n > 0 ? values.reduce((s, v) => s + v, 0) / n : 0;

  const chrome = axes ? PLOT_TOP + AXIS_BAND : 3;
  const minHeight = height + chrome;
  const plotHeight = fill && boxHeight > minHeight ? boxHeight - chrome : height;
  const box: PlotBox = axes
    ? { left: AXIS_GUTTER, right: Math.max(width - 2, 1), top: PLOT_TOP, bottom: PLOT_TOP + plotHeight }
    : { left: 0, right: Math.max(width, 1), top: 2, bottom: 2 + plotHeight };
  const svgHeight = box.bottom + (axes ? AXIS_BAND : 1);
  const slot = (box.right - box.left) / Math.max(n, 1);
  // Cap the column and leave the rest of the band as air between days.
  const barW = Math.max(2, Math.min(MAX_BAR, slot * (axes ? 0.52 : 0.6)));
  const xCenter = (i: number) => box.left + i * slot + slot / 2;
  const yFor = (v: number) => box.bottom - (v / top) * (box.bottom - box.top);
  const focus = active ?? last;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((cur) => Math.max(0, Math.min(n - 1, (cur ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
  };

  const note = (i: number) => {
    const v = values[i] ?? 0;
    if (i === last && active !== null) return "Today so far";
    if (avg <= 0 || v === 0) return undefined;
    const ratio = v / avg;
    return ratio >= 1.05 ? `${ratio.toFixed(1)}× the daily average` : ratio <= 0.95 ? `${Math.round((1 - ratio) * 100)}% under the average` : "Right on the average";
  };

  const avgY = Math.round(yFor(avg)) + 0.5;

  return (
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
      onPointerLeave={() => setActive(null)}
    >
      {width > 0 && n > 0 && (
        <svg width={width} height={svgHeight} className="absolute left-0 top-0 block overflow-visible" aria-hidden="true">
          {axes && (
            <GridY
              ticks={ticks}
              box={box}
              yFor={yFor}
              format={format}
              clearY={active !== null && values[active] > 0 ? Math.round(yFor(values[active])) : null}
            />
          )}

          {/* The hovered day's slot, gliding from day to day. */}
          <rect
            className="admin-glide"
            x={box.left + 1}
            y={box.top - (axes ? 4 : 2)}
            width={Math.max(slot - 2, 0)}
            height={box.bottom - box.top + (axes ? 4 : 3)}
            rx={axes ? 8 : 4}
            style={{ fill: "var(--admin-fill-strong)", opacity: active === null ? 0 : 1, transform: `translateX(${at * slot}px)` }}
          />

          <g className="admin-chart-rise">
            {values.map((v, i) => {
              if (v <= 0) return null;
              const y = yFor(v);
              const h = Math.max(box.bottom - y, axes ? 3 : 2);
              return (
                <path
                  key={dates[i]}
                  d={columnPath(xCenter(i) - barW / 2, box.bottom - h, barW, h)}
                  style={{
                    fill: i === focus ? color : restColor,
                    transition: "fill 180ms ease",
                    animationDelay: `${Math.min(i * 18, 540)}ms`,
                  }}
                />
              );
            })}
          </g>

          {/* The average rides over the columns as a dotted reference line;
              its label is knocked out of the surface so a bar never runs
              through the text. */}
          {axes && showAverage && avg > 0 && (
            <g className="admin-late-in pointer-events-none">
              <line
                x1={box.left}
                x2={box.right}
                y1={avgY}
                y2={avgY}
                style={{ stroke: "var(--color-heading)", opacity: 0.35 }}
                strokeWidth={1.25}
                strokeLinecap="round"
                strokeDasharray="0.01 4"
              />
              <text
                x={box.left + 6}
                y={avgY - 7}
                className="tabular-nums"
                paintOrder="stroke"
                style={{
                  fill: "var(--color-subtle)",
                  stroke: "var(--color-surface)",
                  strokeWidth: 4,
                  strokeLinejoin: "round",
                  fontSize: 10.5,
                  fontWeight: 500,
                }}
              >
                Avg {formatCompactValue(Math.round(avg * 10) / 10, format)}
              </text>
            </g>
          )}

          {/* Empty days keep the rhythm with a dot on the baseline. */}
          {values.map((v, i) =>
            v > 0 ? null : (
              <circle
                key={`z-${dates[i]}`}
                cx={xCenter(i)}
                cy={box.bottom - (axes ? 2.5 : 1.5)}
                r={axes ? 1.5 : 1.25}
                style={{ fill: "var(--viz-baseline)" }}
              />
            )
          )}

          {axes && active !== null && values[active] > 0 && (
            <AxisValuePill
              y={Math.round(yFor(values[active]))}
              box={box}
              toX={xCenter(active) - barW / 2}
              label={formatCompactValue(values[active], format)}
            />
          )}

          {axes && <XLabels dates={dates} xFor={xCenter} y={box.bottom + 18} width={box.right - box.left} />}

          {values.map((_, i) => (
            <rect
              key={`hit-${dates[i]}`}
              x={box.left + i * slot}
              y={box.top - (axes ? 0 : 2)}
              width={slot}
              height={box.bottom - box.top + (axes ? 0 : 3)}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
            />
          ))}
        </svg>
      )}

      {active !== null && width > 0 && (
        <ChartTooltip
          x={xCenter(active)}
          top={box.top}
          containerWidth={width}
          centered={!axes}
          title={active === last ? `${formatDay(dates[active])} · Today` : formatDay(dates[active])}
          rows={[{ value: formatValue(values[active] ?? 0, format), color, key: "square" }]}
          note={axes ? note(active) : undefined}
        />
      )}

      <SrTable caption={ariaLabel} dates={dates} series={[{ label, values }]} format={format} />
    </div>
  );
}
