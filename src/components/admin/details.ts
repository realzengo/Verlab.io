import type { ApiEndpointHealth, SystemJob } from "@/lib/types";
import { JOB_TYPE_LABEL } from "@/components/admin/job-labels";
import { formatDay, formatValue, type ValueFormat } from "@/components/admin/charts/format";

/**
 * What a list row opens when it's clicked. Plain data, so a server page can
 * build it and hand it to a client list (functions can't cross that line).
 */
export interface DetailRow {
  label: string;
  value: string;
  tone?: "default" | "good" | "warning" | "bad" | "muted";
  /** Identifiers and paths: mono, and copyable. */
  mono?: boolean;
  /** Opens in a new tab. */
  href?: string;
}

export interface DetailSpec {
  title: string;
  subtitle?: string;
  /** A small mono tag beside the title, e.g. an HTTP method. */
  tag?: string;
  rows: DetailRow[];
  /** A passage below the rows: an error message, a most-common reason. */
  note?: { label: string; text: string; tone?: "default" | "bad" };
  /** A daily line across the top of the dialog. */
  series?: { label: string; dates: string[]; values: number[]; format?: ValueFormat };
}

export function endpointStatus(errorRatePct: number): { variant: "success" | "warning" | "danger"; label: string } {
  if (errorRatePct >= 10) return { variant: "danger", label: "Degraded" };
  if (errorRatePct > 0) return { variant: "warning", label: "Watch" };
  return { variant: "success", label: "Healthy" };
}

export function endpointDetail(row: ApiEndpointHealth): DetailSpec {
  const status = endpointStatus(row.errorRatePct);
  return {
    title: row.endpoint,
    tag: row.method,
    subtitle: "Today's calls, latency and errors",
    rows: [
      { label: "Status", value: status.label, tone: status.variant === "success" ? "good" : status.variant === "warning" ? "warning" : "bad" },
      { label: "Calls today", value: row.callsToday.toLocaleString("en-US") },
      { label: "Median (p50)", value: formatValue(row.p50Ms, "ms") },
      { label: "Slowest 5% (p95)", value: formatValue(row.p95Ms, "ms"), tone: row.p95Ms >= 5000 ? "warning" : "default" },
      { label: "Error rate", value: `${row.errorRatePct}%`, tone: row.errorRatePct > 0 ? "bad" : "default" },
      { label: "Endpoint", value: row.endpoint, mono: true },
    ],
  };
}

/**
 * A tool or action's daily counts over the window: total, share, pace, its
 * busiest day and when it last ran, plus the line itself.
 */
export function seriesDetail({
  title,
  subtitle,
  dates,
  values,
  total,
  unit,
  format = "number",
}: {
  title: string;
  subtitle?: string;
  dates: string[];
  values: number[];
  /** Everything in the list, for the share. */
  total: number;
  /** "runs", "credits" */
  unit: string;
  format?: ValueFormat;
}): DetailSpec {
  const sum = values.reduce((s, v) => s + v, 0);
  let peak = -1;
  values.forEach((v, i) => {
    if (peak === -1 || v > values[peak]) peak = i;
  });
  let last = -1;
  values.forEach((v, i) => {
    if (v > 0) last = i;
  });
  const fmt = (n: number) => formatValue(n, format);
  return {
    title,
    subtitle: subtitle ?? `Last ${dates.length} days`,
    series: { label: title, dates, values, format },
    rows: [
      { label: `Total ${unit}`, value: fmt(sum) },
      { label: "Share of all", value: total > 0 ? `${Math.round((sum / total) * 100)}%` : "0%" },
      { label: "Daily average", value: fmt(Math.round((sum / Math.max(dates.length, 1)) * 10) / 10) },
      {
        label: "Busiest day",
        value: peak >= 0 && values[peak] > 0 ? `${formatDay(dates[peak])} · ${fmt(values[peak])}` : "—",
        tone: peak >= 0 && values[peak] > 0 ? "default" : "muted",
      },
      { label: "Last active", value: last >= 0 ? formatDay(dates[last]) : "Not in this window", tone: last >= 0 ? "default" : "muted" },
    ],
  };
}

/** A plain ranked share: value and slice of the whole. */
export function shareDetail(title: string, value: number, total: number, unit: string, format: ValueFormat = "number"): DetailSpec {
  return {
    title,
    rows: [
      { label: unit, value: formatValue(value, format) },
      { label: "Share of all", value: total > 0 ? `${Math.round((value / total) * 100)}%` : "0%" },
    ],
  };
}

/** "4m ago", "2h ago", "3d ago" against a fixed now, so server and client agree. */
export function timeAgo(iso: string, nowIso: string): string {
  const minutes = Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** A run's length at a readable scale: 8.4s, 3.2m, 5.1h, 2.3d. */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms < 172_800_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}

function mostCommon(values: string[]): { value: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: { value: string; count: number } | null = null;
  for (const [value, count] of counts) if (!best || count > best.count) best = { value, count };
  return best;
}

/**
 * A slice of the job queue (one tool, or one status): how it went, how long
 * it took, when it last ran, and the error people hit most.
 */
export function jobsDetail({
  title,
  subtitle,
  jobs,
  allCount,
  nowIso,
  byTool = false,
}: {
  title: string;
  subtitle?: string;
  jobs: SystemJob[];
  /** Size of the whole window, for the share. */
  allCount: number;
  nowIso: string;
  /** A status slice also names the tool it hit most. */
  byTool?: boolean;
}): DetailSpec {
  const n = (status: SystemJob["status"]) => jobs.filter((j) => j.status === status).length;
  const ok = n("success");
  const failed = n("failed");
  const stuck = n("stuck");
  const inFlight = n("running") + n("queued");
  const finished = ok + failed + stuck;
  const durations = jobs.map((j) => j.durationMs).filter((d): d is number => typeof d === "number" && d > 0);
  const latest = jobs.reduce<string | null>((max, j) => (!max || j.startedAt > max ? j.startedAt : max), null);
  const topTool = byTool ? mostCommon(jobs.map((j) => JOB_TYPE_LABEL[j.type])) : null;
  const topError = mostCommon(jobs.filter((j) => j.status === "failed" && j.errorMessage).map((j) => j.errorMessage!.trim()));

  const rows: DetailRow[] = [
    { label: "Jobs", value: `${jobs.length.toLocaleString("en-US")} of ${allCount.toLocaleString("en-US")}` },
  ];
  if (!byTool) {
    rows.push(
      { label: "Succeeded", value: ok.toLocaleString("en-US"), tone: ok > 0 ? "good" : "muted" },
      { label: "Failed", value: failed.toLocaleString("en-US"), tone: failed > 0 ? "bad" : "muted" },
      { label: "Stuck", value: stuck.toLocaleString("en-US"), tone: stuck > 0 ? "bad" : "muted" }
    );
    if (inFlight > 0) rows.push({ label: "In flight", value: inFlight.toLocaleString("en-US") });
    rows.push({
      label: "Success rate",
      value: finished > 0 ? `${Math.round((ok / finished) * 1000) / 10}%` : "—",
      tone: finished === 0 ? "muted" : ok / finished >= 0.9 ? "good" : ok / finished >= 0.7 ? "warning" : "bad",
    });
  } else if (topTool) {
    rows.push({ label: "Mostly from", value: `${topTool.value} · ${topTool.count}` });
  }
  rows.push(
    {
      label: "Average duration",
      value: durations.length ? formatDuration(durations.reduce((s, d) => s + d, 0) / durations.length) : "—",
      tone: durations.length ? "default" : "muted",
    },
    { label: "Latest", value: latest ? timeAgo(latest, nowIso) : "—", tone: latest ? "default" : "muted" }
  );

  return {
    title,
    subtitle,
    rows,
    note: topError
      ? { label: topError.count > 1 ? `Most common error · ${topError.count} jobs` : "Error", text: topError.value, tone: "bad" }
      : undefined,
  };
}
