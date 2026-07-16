"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { toneHex } from "@/lib/charts";
import {
  accentColor,
  formatCompact,
  MetricChart,
  seriesColor,
  type ChartSeries,
  type ChartView,
  type MetricAccent,
  type MetricSeries,
  type SeriesPoint,
} from "./MetricChart";
import { PeriodSelect, ViewToggle, type PeriodOption } from "./MetricControls";

export type { SeriesPoint, MetricSeries, MetricAccent, ChartView, PeriodOption };

export type CardSize = "sm" | "md" | "lg";

export interface ProgressMetricCardProps {
  title: string;
  total?: string | number;
  delta?: string;
  deltaLabel?: string;
  percent?: string;
  trend?: "up" | "down";
  unit?: string;
  period?: string;
  periodOptions?: PeriodOption[];
  onPeriodChange?: (option: PeriodOption) => void;
  defaultView?: ChartView;
  accent?: MetricAccent;
  /** Single series. Provide this OR `series`. */
  data?: SeriesPoint[];
  /** Multiple named series. Takes priority over `data`. */
  series?: MetricSeries[];
  defaultIndex?: number;
  size?: CardSize;
  /** Show secondary stats (peak / low / avg) in the footer. */
  showStats?: boolean;
  /** Serializable formatting preset — safe to set from a Server Component. Defaults to plain compact numbers. */
  format?: "number" | "currency";
  /** Custom formatters. Functions can't cross the Server->Client boundary — only pass these from a "use client" caller. */
  valueFormatter?: (value: number) => string;
  dateFormatter?: (date: string) => string;
  loading?: boolean;
  className?: string;
}

const DEFAULT_PERIODS: PeriodOption[] = [
  { label: "Past 7 days", points: 7 },
  { label: "Past 14 days", points: 14 },
  { label: "Past 30 days" },
];

// Share of the card (from the right) occupied by the background chart.
const REGION_W = 62; // %
// Variation below this threshold reads as "stable" -> neutral accent.
const NEUTRAL_PCT = 0.5;

const SIZES: Record<
  CardSize,
  { minH: string; pad: string; footer: string; title: string; headline: string; tooltipTopOffset: number }
> = {
  sm: { minH: "min-h-[260px]", pad: "px-6 pt-5", footer: "px-6 py-3", title: "text-[15px]", headline: "text-[46px]", tooltipTopOffset: 44 },
  md: { minH: "min-h-[380px]", pad: "px-8 pt-7", footer: "px-8 py-4", title: "text-[17px]", headline: "text-[72px]", tooltipTopOffset: 52 },
  lg: { minH: "min-h-[460px]", pad: "px-10 pt-9", footer: "px-10 py-5", title: "text-[19px]", headline: "text-[88px]", tooltipTopOffset: 60 },
};

const sliceWindow = (points: SeriesPoint[], n?: number) => (n && n < points.length ? points.slice(-n) : points);

export default function ProgressMetricCard({
  title,
  total,
  delta,
  deltaLabel = "today",
  percent,
  trend,
  unit,
  period = "Past 30 days",
  periodOptions,
  onPeriodChange,
  defaultView = "curve",
  accent,
  data,
  series,
  defaultIndex,
  size = "md",
  showStats = true,
  format = "number",
  valueFormatter,
  dateFormatter,
  loading = false,
  className = "",
}: ProgressMetricCardProps) {
  const { resolvedTheme } = useTheme();
  const sz = SIZES[size];
  const shell = `relative flex ${sz.minH} w-full flex-col overflow-hidden rounded-card border border-hairline bg-surface shadow-card ${className}`;

  const periods = periodOptions ?? DEFAULT_PERIODS;
  const [selectedLabel, setSelectedLabel] = useState(period);
  const [view, setView] = useState<ChartView>(defaultView);

  const baseSeries: MetricSeries[] = useMemo(
    () => (series?.length ? series : [{ name: title, data: data ?? [], accent }]),
    [series, data, title, accent]
  );

  const selectedOption = periods.find((p) => p.label === selectedLabel) ?? periods[periods.length - 1];

  const visibleSeries = useMemo(
    () => baseSeries.map((s) => ({ ...s, data: sliceWindow(s.data, selectedOption?.points) })),
    [baseSeries, selectedOption]
  );

  const primary = visibleSeries[0];
  const isMulti = visibleSeries.length > 1;
  const hasData = (primary?.data.length ?? 0) >= 2;

  const stats = useMemo(() => {
    const vals = primary?.data.map((d) => d.value) ?? [];
    const sum = vals.reduce((a, b) => a + b, 0);
    const first = vals[0] ?? 0;
    const last = vals[vals.length - 1] ?? 0;
    const prev = vals[vals.length - 2] ?? first;
    const net = last - first;
    return {
      sum,
      net,
      pct: first ? (net / first) * 100 : 0,
      step: last - prev,
      peak: vals.length ? Math.max(...vals) : 0,
      low: vals.length ? Math.min(...vals) : 0,
      avg: vals.length ? sum / vals.length : 0,
    };
  }, [primary]);

  const resolvedTrend: "up" | "down" | "flat" =
    trend ?? (Math.abs(stats.pct) < NEUTRAL_PCT ? "flat" : stats.net >= 0 ? "up" : "down");
  const resolvedAccent: MetricAccent = accent ?? (resolvedTrend === "flat" ? "neutral" : resolvedTrend === "up" ? "up" : "down");
  const color = accentColor(resolvedAccent, resolvedTheme);
  const TrendIcon = resolvedTrend === "flat" ? ArrowRight : resolvedTrend === "down" ? ArrowDown : ArrowUp;

  const fmtCompact = valueFormatter ?? ((n: number) => (format === "currency" ? `$${formatCompact(n)}` : formatCompact(n)));
  const fmtFull =
    valueFormatter ??
    ((n: number) => (format === "currency" ? `$${n.toLocaleString()}` : n.toLocaleString() + (unit ? ` ${unit}` : "")));
  const fmtDate = dateFormatter ?? ((d: string) => d);
  const sign = (n: number) => (n >= 0 ? "+" : "−") + fmtCompact(Math.abs(n));

  const displayTotal = total ?? fmtCompact(stats.sum);
  const displayDelta = delta ?? sign(stats.step);
  const displayPercent = percent ?? `${Math.abs(stats.pct).toFixed(1)}%`;

  const chartSeries: ChartSeries[] = visibleSeries.map((s, i) => ({
    name: s.name,
    data: s.data,
    color: s.tone
      ? toneHex(s.tone, resolvedTheme)
      : s.accent
        ? accentColor(s.accent, resolvedTheme).stroke
        : isMulti
          ? seriesColor(i, resolvedTheme)
          : color.stroke,
  }));

  const lastIndex = (primary?.data.length ?? 1) - 1;
  const fallback = Math.min(defaultIndex ?? lastIndex, lastIndex);

  const handlePeriodChange = (option: PeriodOption) => {
    setSelectedLabel(option.label);
    onPeriodChange?.(option);
  };

  if (loading) {
    return (
      <div className={shell} aria-busy="true">
        <div className={`flex flex-1 flex-col ${sz.pad}`}>
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 animate-pulse rounded bg-hairline" />
            <div className="h-5 w-24 animate-pulse rounded bg-hairline" />
          </div>
          <div className="mt-6 h-14 w-48 animate-pulse rounded-lg bg-hairline" />
          <div className="mt-auto h-24 w-full animate-pulse rounded-lg bg-hairline/60" />
        </div>
        <div className={`border-t border-hairline ${sz.footer}`}>
          <div className="h-4 w-40 animate-pulse rounded bg-hairline" />
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className={shell}>
        <div className={`flex flex-1 flex-col ${sz.pad}`}>
          <h3 className={`${sz.title} font-semibold tracking-tight text-heading`}>{title}</h3>
          <div className="flex flex-1 flex-col items-center justify-center gap-1 py-10 text-center">
            <p className="text-sm font-medium text-heading">No data yet</p>
            <p className="text-xs text-body">Metrics will appear once data is available.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      {/* Chart region (right side, behind content) */}
      <div className="absolute inset-y-0 right-0 z-0" style={{ width: `${REGION_W}%` }}>
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `linear-gradient(to left, ${color.stroke}29, transparent 80%)` }}
        />

        <MetricChart
          series={chartSeries}
          view={view}
          defaultIndex={fallback}
          valueFormatter={fmtFull}
          dateFormatter={fmtDate}
          tooltipTopOffset={sz.tooltipTopOffset}
        />
      </div>

      {/* Foreground content */}
      <div className={`pointer-events-none relative z-10 flex flex-1 flex-col ${sz.pad}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 pointer-events-auto">
            <h3 className={`${sz.title} font-semibold tracking-tight text-heading`}>{title}</h3>
            <ViewToggle value={view} onChange={setView} />
          </div>
          <div className="flex items-center gap-3.5 text-[14px]">
            <span className="flex items-center gap-1 font-medium" style={{ color: color.text }}>
              <TrendIcon size={16} strokeWidth={2.5} />
              {displayPercent}
            </span>
            <PeriodSelect
              value={selectedLabel}
              options={periods}
              onChange={handlePeriodChange}
              accentText={color.text}
            />
          </div>
        </div>

        {isMulti && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            {chartSeries.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-[12px] text-body">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
        )}

        <div className={`mt-5 ${sz.headline} font-medium leading-none tracking-tight text-heading`}>
          {displayTotal}
        </div>
      </div>

      {/* Opaque footer: delta on the left, secondary stats on the right */}
      <div
        className={`relative z-10 flex items-center justify-between gap-4 border-t border-hairline bg-surface ${sz.footer} text-[14px]`}
      >
        <div>
          <span className="font-medium" style={{ color: color.text }}>
            {displayDelta}
          </span>{" "}
          <span className="text-body">{deltaLabel}</span>
        </div>
        {showStats && (
          <div className="flex items-center gap-2.5 text-[12px] text-body">
            <span>
              <span className="font-medium text-heading">{fmtCompact(stats.peak)}</span> peak
            </span>
            <span className="opacity-40">·</span>
            <span>
              <span className="font-medium text-heading">{fmtCompact(stats.low)}</span> low
            </span>
            <span className="opacity-40">·</span>
            <span>
              <span className="font-medium text-heading">{fmtCompact(Math.round(stats.avg))}</span> avg
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
