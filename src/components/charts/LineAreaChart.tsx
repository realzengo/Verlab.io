"use client";

import { useMemo, useRef, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { CHART_CHROME, toneHex, withAlpha } from "@/lib/charts";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ToolTone } from "@/lib/types";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

export interface ChartSeries {
  key: string;
  label: string;
  tone: ToolTone;
  data: number[];
}

const VIEW_W = 640;
const PLOT_H = 200;

function niceTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [0, max || 1];
  const span = max - min;
  const rawStep = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep || 1));
  const residual = rawStep / magnitude;
  const niceResidual = residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1;
  const step = niceResidual * magnitude;
  const niceMin = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let t = niceMin; t <= max + step * 0.001; t += step) ticks.push(Math.round(t));
  return ticks;
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function LineAreaChart({
  labels,
  series,
  areaFill = false,
  height = PLOT_H,
  unit = "number",
}: {
  labels: string[];
  series: ChartSeries[];
  areaFill?: boolean;
  height?: number;
  unit?: "number" | "currency";
}) {
  const valueFormatter = (n: number) => (unit === "currency" ? `$${formatNumber(n)}` : formatNumber(n));
  const { resolvedTheme } = useTheme();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [tableView, setTableView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleSeries = series.filter((s) => !hiddenKeys.has(s.key));
  const n = labels.length;

  const { min, max } = useMemo(() => {
    const values = visibleSeries.flatMap((s) => s.data);
    if (values.length === 0) return { min: 0, max: 10 };
    const dataMin = areaFill ? 0 : Math.min(...values);
    const dataMax = Math.max(...values);
    const pad = (dataMax - dataMin) * 0.12 || 1;
    return { min: areaFill ? 0 : Math.max(0, dataMin - pad), max: dataMax + pad };
  }, [visibleSeries, areaFill]);

  const ticks = niceTicks(min, max, 4);
  const tickMax = ticks[ticks.length - 1] || max;

  function yFor(v: number) {
    return height - ((v - min) / (tickMax - min || 1)) * height;
  }
  function xFor(i: number) {
    return n > 1 ? (i / (n - 1)) * VIEW_W : 0;
  }

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(pct * (n - 1)));
  }

  const grid = CHART_CHROME.grid[resolvedTheme];
  const axis = CHART_CHROME.axis[resolvedTheme];
  const tickStride = Math.max(1, Math.ceil(n / 7));

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((s) => {
            const hidden = hiddenKeys.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() =>
                  setHiddenKeys((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.key)) next.delete(s.key);
                    else next.add(s.key);
                    return next;
                  })
                }
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-opacity",
                  hidden ? "text-subtle opacity-50" : "text-body"
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: toneHex(s.tone, resolvedTheme) }} />
                {s.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setTableView((v) => !v)}
            className="ml-auto text-xs font-semibold text-primary hover:underline"
          >
            {tableView ? "View chart" : "View as table"}
          </button>
        </div>
      )}
      {series.length === 1 && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setTableView((v) => !v)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {tableView ? "View chart" : "View as table"}
          </button>
        </div>
      )}

      {tableView ? (
        <div className="max-h-72 overflow-y-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                {series.map((s) => (
                  <TableHeaderCell key={s.key} className="text-right">
                    {s.label}
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <tbody>
              {labels.map((label, i) => (
                <TableRow key={label}>
                  <TableCell>{formatDateLabel(label)}</TableCell>
                  {series.map((s) => (
                    <TableCell key={s.key} className="text-right tabular-nums">
                      {valueFormatter(s.data[i] ?? 0)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex shrink-0 flex-col justify-between py-0.5 text-right" style={{ height }}>
            {[...ticks].reverse().map((t) => (
              <span key={t} className="text-[10px] tabular-nums leading-none text-body">
                {valueFormatter(t)}
              </span>
            ))}
          </div>

          <div
            ref={containerRef}
            className="relative min-w-0 flex-1 cursor-crosshair"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <svg viewBox={`0 0 ${VIEW_W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
              {ticks.map((t) => (
                <line
                  key={t}
                  x1={0}
                  x2={VIEW_W}
                  y1={yFor(t)}
                  y2={yFor(t)}
                  stroke={grid}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {visibleSeries.map((s) => {
                const color = toneHex(s.tone, resolvedTheme);
                const linePath = s.data
                  .map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`)
                  .join(" ");
                const areaPath = areaFill
                  ? `${linePath} L${xFor(n - 1).toFixed(1)},${height} L${xFor(0).toFixed(1)},${height} Z`
                  : null;
                return (
                  <g key={s.key}>
                    {areaPath && <path d={areaPath} fill={withAlpha(color, 12)} stroke="none" />}
                    <path d={linePath} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                  </g>
                );
              })}

              {hoverIndex !== null && (
                <line
                  x1={xFor(hoverIndex)}
                  x2={xFor(hoverIndex)}
                  y1={0}
                  y2={height}
                  stroke={axis}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="3,3"
                />
              )}
              {hoverIndex !== null &&
                visibleSeries.map((s) => (
                  <circle
                    key={s.key}
                    cx={xFor(hoverIndex)}
                    cy={yFor(s.data[hoverIndex] ?? 0)}
                    r={4}
                    fill={toneHex(s.tone, resolvedTheme)}
                    stroke={resolvedTheme === "dark" ? "#0a0a0d" : "#ffffff"}
                    strokeWidth={2}
                  />
                ))}
            </svg>

            {hoverIndex !== null && (
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-y-1 rounded-chip border border-hairline bg-surface px-2.5 py-2 text-xs shadow-card-hover"
                style={{
                  left: `${(xFor(hoverIndex) / VIEW_W) * 100}%`,
                  transform: `translateX(${hoverIndex > n / 2 ? "-105%" : "5%"})`,
                }}
              >
                <p className="mb-1 font-semibold text-heading">{formatDateLabel(labels[hoverIndex])}</p>
                <div className="flex flex-col gap-0.5">
                  {visibleSeries.map((s) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: toneHex(s.tone, resolvedTheme) }} />
                      <span className="text-body">{s.label}</span>
                      <span className="ml-auto font-semibold tabular-nums text-heading">
                        {valueFormatter(s.data[hoverIndex] ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!tableView && (
        <div className="mt-1.5 flex pl-11 text-[10px] text-body">
          <div className="flex flex-1 justify-between">
            {labels.map((label, i) =>
              i % tickStride === 0 || i === n - 1 ? (
                <span key={label} className="tabular-nums">
                  {formatDateLabel(label)}
                </span>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
