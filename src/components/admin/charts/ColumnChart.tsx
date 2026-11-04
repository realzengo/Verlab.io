"use client";

import { useState, type KeyboardEvent } from "react";
import { formatDay, formatValue, niceTicks, type ValueFormat } from "./format";
import { AXIS_BAND, AXIS_GUTTER, ChartTooltip, GridY, PLOT_TOP, SrTable, XLabels, type PlotBox } from "./parts";
import { useElementWidth } from "./useElementWidth";

const MAX_BAR = 24;
const RADIUS = 4;

/** A column with a 4px rounded data-end and a square foot on the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Daily columns, one series. Each day's slot is its own hit target; the
 * hovered column holds full strength while the rest step back.
 */
export function ColumnChart({
  dates,
  values,
  label,
  format = "number",
  height = 200,
  color = "var(--viz-1)",
  ariaLabel,
}: {
  dates: string[];
  values: number[];
  /** Series name, for the table twin. */
  label: string;
  format?: ValueFormat;
  height?: number;
  color?: string;
  ariaLabel: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const n = values.length;
  const ticks = niceTicks(Math.max(0, ...values));
  const top = ticks[ticks.length - 1] || 1;

  const box: PlotBox = { left: AXIS_GUTTER, right: Math.max(width - 2, 1), top: PLOT_TOP, bottom: PLOT_TOP + height };
  const svgHeight = box.bottom + AXIS_BAND;
  const slot = (box.right - box.left) / Math.max(n, 1);
  // Cap the column and leave the rest of the band as air between days.
  const barW = Math.max(2, Math.min(MAX_BAR, slot * 0.58));
  const xCenter = (i: number) => box.left + i * slot + slot / 2;
  const yFor = (v: number) => box.bottom - (v / top) * (box.bottom - box.top);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((cur) => Math.max(0, Math.min(n - 1, (cur ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
  };

  return (
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
          <GridY ticks={ticks} box={box} yFor={yFor} format={format} />

          <g className="admin-chart-rise">
            {values.map((v, i) => {
              if (v <= 0) return null;
              const y = yFor(v);
              const h = Math.max(box.bottom - y, 2);
              return (
                <path
                  key={dates[i]}
                  d={columnPath(xCenter(i) - barW / 2, box.bottom - h, barW, h)}
                  style={{
                    fill: color,
                    opacity: active === null || active === i ? 1 : 0.45,
                    transition: "opacity 120ms ease",
                  }}
                />
              );
            })}
          </g>

          <XLabels dates={dates} xFor={xCenter} y={box.bottom + 18} width={box.right - box.left} />

          {values.map((_, i) => (
            <rect
              key={`hit-${dates[i]}`}
              x={box.left + i * slot}
              y={box.top}
              width={slot}
              height={box.bottom - box.top}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </svg>
      )}

      {active !== null && width > 0 && (
        <ChartTooltip
          x={xCenter(active)}
          top={box.top}
          containerWidth={width}
          title={formatDay(dates[active])}
          rows={[{ value: formatValue(values[active] ?? 0, format), color, key: "square" }]}
        />
      )}

      <SrTable caption={ariaLabel} dates={dates} series={[{ label, values }]} format={format} />
    </div>
  );
}
