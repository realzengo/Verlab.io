"use client";

import { useMemo, useRef, useState } from "react";
import { STATUS_HEX, TONE_HEX } from "@/lib/charts";
import type { ToolTone } from "@/lib/types";

export interface SeriesPoint {
  date: string;
  value: number;
}

export type MetricAccent = "up" | "down" | "neutral";
export type ChartView = "curve" | "bar";

export interface MetricSeries {
  name: string;
  data: SeriesPoint[];
  accent?: MetricAccent;
  /** Fixed tone (e.g. matching this series elsewhere in the dashboard), takes priority over `accent`. */
  tone?: ToolTone;
}

export interface ChartSeries {
  name: string;
  data: SeriesPoint[];
  color: string;
}

const VIEW_W = 100;
const VIEW_H = 100;

export function accentColor(accent: MetricAccent, resolvedTheme: "light" | "dark"): { stroke: string; text: string } {
  if (accent === "up") return { stroke: STATUS_HEX.good[resolvedTheme], text: STATUS_HEX.good[resolvedTheme] };
  if (accent === "down") return { stroke: STATUS_HEX.critical[resolvedTheme], text: STATUS_HEX.critical[resolvedTheme] };
  return { stroke: "#8a8a93", text: "#8a8a93" };
}

export function seriesColor(index: number, resolvedTheme: "light" | "dark"): string {
  const tones = Object.values(TONE_HEX);
  return tones[index % tones.length][resolvedTheme];
}

export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(value)}`;
}

/** Smooth path through points via Catmull-Rom -> cubic Bezier conversion. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;
  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

interface MetricChartProps {
  series: ChartSeries[];
  view: ChartView;
  defaultIndex?: number;
  valueFormatter?: (value: number) => string;
  dateFormatter?: (date: string) => string;
  /** Pixels to clear at the top, so the tooltip doesn't sit under the card's header row. */
  tooltipTopOffset?: number;
}

export function MetricChart({
  series,
  view,
  defaultIndex,
  valueFormatter = formatCompact,
  dateFormatter = (d) => d,
  tooltipTopOffset = 8,
}: MetricChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const n = series[0]?.data.length ?? 0;
  const activeIndex = hoverIndex ?? Math.min(defaultIndex ?? n - 1, n - 1);

  const { min, max } = useMemo(() => {
    const values = series.flatMap((s) => s.data.map((d) => d.value));
    if (values.length === 0) return { min: 0, max: 1 };
    const dataMin = view === "bar" ? 0 : Math.min(...values);
    const dataMax = Math.max(...values);
    const pad = (dataMax - dataMin) * 0.15 || 1;
    return { min: view === "bar" ? 0 : Math.max(0, dataMin - pad), max: dataMax + pad };
  }, [series, view]);

  const xFor = (i: number) => (n > 1 ? (i / (n - 1)) * VIEW_W : 0);
  const yFor = (v: number) => VIEW_H - ((v - min) / (max - min || 1)) * VIEW_H;

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(pct * (n - 1)));
  }

  if (n === 0) return null;

  const barGapPct = 0.32;
  const slot = VIEW_W / n;
  const barW = slot * (1 - barGapPct);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      onMouseMove={handleMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="100%" preserveAspectRatio="none">
        {series.map((s, si) => {
          if (view === "bar") {
            return (
              <g key={s.name}>
                {s.data.map((d, i) => {
                  const barH = Math.max(((d.value - min) / (max - min || 1)) * VIEW_H, 0.6);
                  const groupW = barW / series.length;
                  const x = i * slot + (slot - barW) / 2 + si * groupW;
                  return (
                    <rect
                      key={i}
                      x={x}
                      y={VIEW_H - barH}
                      width={Math.max(groupW - 0.4, 0.6)}
                      height={barH}
                      rx={0.6}
                      fill={s.color}
                      opacity={activeIndex === i ? 0.95 : 0.55}
                    />
                  );
                })}
              </g>
            );
          }

          const points = s.data.map((d, i) => ({ x: xFor(i), y: yFor(d.value) }));
          const linePath = smoothPath(points);
          // Overlapping fills turn muddy past ~2 series, so only the primary pair gets a wash under the lines.
          const areaPath =
            series.length <= 2 ? `${linePath} L${xFor(n - 1).toFixed(2)},${VIEW_H} L${xFor(0).toFixed(2)},${VIEW_H} Z` : null;
          return (
            <g key={s.name}>
              {areaPath && <path d={areaPath} fill={s.color} opacity={0.14} stroke="none" />}
              <path
                d={linePath}
                fill="none"
                stroke={s.color}
                strokeWidth={1.6}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          );
        })}

        {view === "curve" && (
          <line
            x1={xFor(activeIndex)}
            x2={xFor(activeIndex)}
            y1={0}
            y2={VIEW_H}
            stroke="currentColor"
            className="text-foreground/10"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="2,2"
          />
        )}
      </svg>

      {/* Rendered as HTML, not SVG geometry — the chart's non-uniform (preserveAspectRatio="none")
          scale would otherwise stretch a <circle> into an ellipse. */}
      {view === "curve" &&
        series.map((s) => (
          <span
            key={s.name}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{
              left: `${(xFor(activeIndex) / VIEW_W) * 100}%`,
              top: `${(yFor(s.data[activeIndex]?.value ?? 0) / VIEW_H) * 100}%`,
              background: s.color,
              borderColor: "var(--color-surface)",
            }}
          />
        ))}

      {hoverIndex !== null && (
        <div
          className="pointer-events-none absolute z-20 rounded-chip border border-hairline bg-surface px-2.5 py-2 text-xs shadow-card-hover"
          style={{
            top: tooltipTopOffset,
            left: `${(xFor(activeIndex) / VIEW_W) * 100}%`,
            transform: `translateX(${activeIndex > n / 2 ? "-105%" : "5%"})`,
          }}
        >
          <p className="mb-1 font-semibold text-heading">{dateFormatter(series[0].data[activeIndex]?.date ?? "")}</p>
          <div className="flex flex-col gap-0.5">
            {series.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="text-body">{s.name}</span>
                <span className="ml-auto font-semibold tabular-nums text-heading">
                  {valueFormatter(s.data[activeIndex]?.value ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
