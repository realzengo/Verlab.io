import "server-only";
import { unstable_cache } from "next/cache";
import { JOB_TYPE_LABEL } from "@/components/admin/job-labels";
import {
  getApiErrorRate,
  getFailedPayments,
  getJobHealth24h,
  getLatestHealthCheck,
  getRenderHealth,
  getWeekOverWeekCounts,
} from "@/lib/server/admin-queries";
import { getWhopWebhookEnabled } from "@/lib/server/whop-sync";
import { transcriptionOutage } from "@/lib/server/clips/transcription-status";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { AdminPulse, PulseItem } from "@/lib/types";

// The sidebar status card: is the app healthy, is anything broken, are
// people signing up and using it. Problems come first and set the headline;
// growth updates follow. Every source is read on its own, so one failing
// query drops its line instead of the whole card.

const DAY_MS = 24 * 60 * 60 * 1000;
/** Health checks run every 5 minutes; this long without one means the crons stopped. */
const HEALTH_STALE_MS = 20 * 60 * 1000;
const MAX_ITEMS = 4;
/** The render worker checks in every 15s; this long without one means it's down. */
const WORKER_STALE_MS = 2 * 60 * 1000;
/** A render waiting this long means the worker is behind (or stuck). */
const QUEUE_SLOW_MS = 10 * 60 * 1000;

// Whop's API is the slow, rate-limited source and its answer rarely changes.
const whopWebhookEnabled = unstable_cache(getWhopWebhookEnabled, ["admin-pulse-whop-webhook"], { revalidate: 600 });

const plural = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;

function ago(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

/** "Signups up 32%": this week against the week before. */
function trendItem(id: string, label: string, [now, before]: [number, number], href: string): PulseItem {
  const noun = label.toLowerCase();
  if (now === 0 && before === 0) {
    return { id, href, tone: "neutral", trend: "flat", title: `No ${noun} this week`, detail: "None the week before either" };
  }
  if (before === 0) {
    return { id, href, tone: "good", trend: "up", title: `${formatNumber(now)} ${noun} this week`, detail: "None the week before" };
  }
  const change = (now - before) / before;
  const detail = `${formatNumber(now)} this week vs ${formatNumber(before)}`;
  if (Math.abs(change) < 0.05) return { id, href, tone: "neutral", trend: "flat", title: `${label} steady`, detail };
  const pct = Math.round(Math.abs(change) * 100);
  // Past 10x a percentage stops reading ("up 180450%"); say the multiple.
  if (change >= 9) return { id, href, tone: "good", trend: "up", title: `${label} up ${Math.round(now / before).toLocaleString("en-US")}×`, detail };
  if (change > 0) return { id, href, tone: "good", trend: "up", title: `${label} up ${pct}%`, detail };
  // A halving off a real base is worth a look; a dip is just news.
  return { id, href, tone: change <= -0.5 && before >= 5 ? "warning" : "neutral", trend: "down", title: `${label} down ${pct}%`, detail };
}

export async function getAdminPulse(): Promise<AdminPulse> {
  const results = await Promise.allSettled([
    getJobHealth24h(),
    getWeekOverWeekCounts(),
    getApiErrorRate(),
    getFailedPayments(),
    getLatestHealthCheck(),
    whopWebhookEnabled(),
    getRenderHealth(),
    transcriptionOutage(),
  ]);
  if (results.every((r) => r.status === "rejected")) throw (results[0] as PromiseRejectedResult).reason;
  for (const r of results) if (r.status === "rejected") console.error("[admin/pulse]", r.reason);
  const ok = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);
  const jobs = ok(results[0]);
  const weeks = ok(results[1]);
  const apiErrors = ok(results[2]);
  const failedPayments = ok(results[3]);
  const health = ok(results[4]);
  const webhookOn = ok(results[5]);
  const renders = ok(results[6]);
  const transcriptionDown = ok(results[7]);
  const now = Date.now();
  const problems: PulseItem[] = [];

  if (transcriptionDown) {
    problems.push({
      id: "replicate-credit",
      tone: "critical",
      title: "Replicate is out of credit",
      detail: `Clipping can't transcribe · since ${ago(now - new Date(transcriptionDown.since).getTime())}`,
      href: "/admin/system",
    });
  }

  if (webhookOn === false) {
    problems.push({ id: "whop-webhook", tone: "critical", title: "Whop webhook is off", detail: "New payments aren't recorded", href: "/admin/revenue" });
  }

  if (health) {
    const age = now - new Date(health.createdAt).getTime();
    if (age > HEALTH_STALE_MS) {
      problems.push({ id: "health-stale", tone: "warning", title: "Health checks stopped", detail: `Last one ${ago(age)}, crons may be down`, href: "/admin/system" });
    } else if (!health.ok) {
      problems.push({ id: "health-down", tone: "critical", title: "Site health check failing", detail: `Checked ${ago(age)}`, href: "/admin/system" });
    }
  }

  if (jobs) {
    // "Voiceover", not "Voiceover generation": the detail line is narrow.
    const worst = jobs.worstType ? JOB_TYPE_LABEL[jobs.worstType].replace(/ generation$/, "") : undefined;
    if (jobs.stuck > 0) {
      problems.push({ id: "jobs-stuck", tone: "critical", title: `${formatNumber(jobs.stuck)} ${plural(jobs.stuck, "job")} stuck`, detail: worst ? `Over an hour · mostly ${worst}` : "Running over an hour", href: "/admin/system" });
    }
    if (jobs.failed > 0) {
      const rate = jobs.failed / Math.max(jobs.settled, 1);
      problems.push({
        id: "jobs-failed",
        tone: rate >= 0.25 && jobs.failed >= 3 ? "critical" : "warning",
        title: `${formatNumber(jobs.failed)} of ${formatNumber(jobs.settled)} jobs failed`,
        detail: worst ? `Last 24h · mostly ${worst}` : "Last 24h",
        href: "/admin/system",
      });
    }
  }

  // The render worker (Railway): down while renders wait is broken; a long
  // queue or many failures is worth a look. Untouched when no one renders.
  if (renders && (renders.queued > 0 || renders.done + renders.failed > 0)) {
    const sinceSeen = renders.workerLastSeen ? now - new Date(renders.workerLastSeen).getTime() : null;
    if (sinceSeen === null || sinceSeen > WORKER_STALE_MS) {
      problems.push({
        id: "render-worker-down",
        tone: "critical",
        title: "Render worker offline",
        detail: `${renders.queued > 0 ? `${formatNumber(renders.queued)} waiting · ` : ""}${sinceSeen === null ? "never checked in" : `last seen ${ago(sinceSeen)}`}`,
        href: "/admin/system",
      });
    } else if (renders.oldestQueuedMs !== null && renders.oldestQueuedMs > QUEUE_SLOW_MS) {
      problems.push({
        id: "render-queue-slow",
        tone: "warning",
        title: `${formatNumber(renders.queued)} ${plural(renders.queued, "render")} waiting`,
        detail: `Oldest for ${ago(renders.oldestQueuedMs).replace(" ago", "")}`,
        href: "/admin/system",
      });
    }
    const settled = renders.done + renders.failed;
    if (renders.failed >= 3 && renders.failed / settled >= 0.2) {
      problems.push({
        id: "renders-failed",
        tone: renders.failed / settled >= 0.5 ? "critical" : "warning",
        title: `${formatNumber(renders.failed)} of ${formatNumber(settled)} renders failed`,
        detail: "Last 24h · server renders",
        href: "/admin/system",
      });
    }
  }

  // A handful of calls can't make a rate; wait for a real sample.
  if (apiErrors && apiErrors.errorRatePct !== null && apiErrors.totalRequests >= 20 && apiErrors.errorRatePct >= 2) {
    problems.push({
      id: "api-errors",
      tone: apiErrors.errorRatePct >= 5 ? "critical" : "warning",
      title: `API errors at ${apiErrors.errorRatePct}%`,
      detail: `Last 24h · ${formatNumber(apiErrors.totalRequests)} calls`,
      href: "/admin/system",
    });
  }

  // A failed renewal is revenue slipping away; a declined checkout is someone
  // who tried to subscribe and whose card said no -- news, not breakage.
  let declined: PulseItem | null = null;
  if (failedPayments) {
    const open = failedPayments.filter((p) => !p.recovered && now - new Date(p.failedAt).getTime() < 7 * DAY_MS);
    const renewals = open.filter((p) => p.kind === "renewal");
    if (renewals.length > 0) {
      const amount = renewals.reduce((s, p) => s + p.amount, 0);
      problems.push({
        id: "renewals-failed",
        tone: "warning",
        icon: "card",
        title: `${renewals.length} ${plural(renewals.length, "renewal")} failed`,
        detail: amount > 0 ? `${formatCurrency(amount)} not recovered yet` : "Not recovered yet",
        href: "/admin/revenue",
      });
    }
    const checkouts = open.filter((p) => p.kind !== "renewal");
    if (checkouts.length > 0) {
      // People, not attempts: one card retried three times is one person.
      const people = new Set(checkouts.map((p) => p.userId ?? p.userEmail ?? p.paymentId)).size;
      declined = {
        id: "checkouts-declined",
        tone: "neutral",
        icon: "card",
        title: `${formatNumber(people)} ${people === 1 ? "person" : "people"} couldn't pay`,
        detail: `${formatNumber(checkouts.length)} declined ${plural(checkouts.length, "checkout")} this week`,
        href: "/admin/revenue",
      };
    }
  }

  const updates: PulseItem[] = [];
  if (weeks) {
    updates.push(trendItem("signups", "Signups", weeks.signups, "/admin/users"));
    const [paidNow, paidBefore] = weeks.newPaying;
    if (paidNow > 0) {
      updates.push({
        id: "new-paying",
        tone: "good",
        trend: paidNow >= paidBefore ? "up" : "down",
        title: `${formatNumber(paidNow)} new ${plural(paidNow, "subscriber")}`,
        detail: paidBefore > 0 ? `This week vs ${formatNumber(paidBefore)} before` : "This week",
        href: "/admin/revenue",
      });
    }
  }
  if (declined) updates.push(declined);
  if (weeks) updates.push(trendItem("runs", "Tool runs", weeks.runs, "/admin/usage"));
  if (renders && renders.done > 0) {
    updates.push({
      id: "renders",
      tone: "neutral",
      title: `${formatNumber(renders.done)} ${plural(renders.done, "clip")} rendered on servers`,
      detail: renders.p95Ms !== null ? `Last 24h · 95% done within ${Math.round(renders.p95Ms / 1000)}s` : "Last 24h",
      href: "/admin/system",
    });
  }

  // Anything flagged leads, worst first -- a growth line can be flagged too
  // (signups halving). The rest keep their order. Signups always keep a line.
  const all = [...problems, ...updates];
  const severity = (i: PulseItem) => (i.tone === "critical" ? 0 : i.tone === "warning" ? 1 : 2);
  const issues = all.filter((i) => severity(i) < 2).sort((a, b) => severity(a) - severity(b));
  let items = [...issues, ...all.filter((i) => severity(i) === 2)].slice(0, MAX_ITEMS);
  const signups = all.find((i) => i.id === "signups");
  if (signups && !items.includes(signups)) items = [...items.slice(0, MAX_ITEMS - 1), signups];

  const status = issues.some((i) => i.tone === "critical") ? "critical" : issues.length > 0 ? "warning" : "good";
  const issueCount = issues.length;

  return {
    status,
    headline: status === "critical" ? "Needs attention" : status === "warning" ? "Worth a look" : "All systems normal",
    issueCount,
    items,
    checkedAt: new Date(now).toISOString(),
  };
}
