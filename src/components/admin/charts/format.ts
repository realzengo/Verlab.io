import { formatChartDate } from "@/lib/charts";
import { formatCurrency, formatNumber } from "@/lib/utils";

/**
 * Formatting presets. Charts are client components fed from server pages, and
 * functions can't cross that boundary -- so pages pick a preset by name.
 */
export type ValueFormat = "number" | "currency" | "percent" | "ms";

/** The exact value: tooltips, table cells, legend rows. */
export function formatValue(value: number, format: ValueFormat = "number"): string {
  if (format === "currency") return formatCurrency(Math.round(value * 100) / 100);
  if (format === "percent") return `${Number(value.toFixed(1))}%`;
  if (format === "ms") return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
  return value.toLocaleString("en-US");
}

/** The short value: axis ticks and anywhere space is tight (1.2K, $4.5K). */
export function formatCompactValue(value: number, format: ValueFormat = "number"): string {
  if (format === "currency") return value >= 1000 ? `$${formatNumber(value)}` : formatCurrency(Math.round(value));
  if (format === "percent") return `${Math.round(value)}%`;
  if (format === "ms") return value >= 1000 ? `${Number((value / 1000).toFixed(1))}s` : `${Math.round(value)}ms`;
  return formatNumber(value);
}

/** A headline figure: exact up to 100K (1,284, not 1.3K), compact past it. */
export function formatStat(value: number): string {
  return Math.abs(value) < 100_000 ? Math.round(value).toLocaleString("en-US") : formatNumber(value);
}

export const formatDay = formatChartDate;

/**
 * Clean axis ticks from 0 to just past `max`: steps of 1, 2, 2.5 or 5 times a
 * power of ten, so the gridlines land on numbers a reader can do maths with.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  // Integer data never gets a 0.5 tick.
  const safeStep = Number.isInteger(max) && step < 1 ? 1 : step;
  const ticks: number[] = [];
  for (let v = 0; v < max + safeStep * 0.999; v += safeStep) ticks.push(Number(v.toFixed(6)));
  return ticks.length > 1 ? ticks : [0, safeStep];
}

/** Indexes of the x-axis labels to show: evenly spaced, always the first and last. */
export function axisLabelIndexes(length: number, maxLabels: number): number[] {
  if (length <= maxLabels) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (maxLabels - 1);
  return Array.from({ length: maxLabels }, (_, i) => Math.round(i * step));
}

export function sumOf(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}
