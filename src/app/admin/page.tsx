import { CircleCheck, CircleX, Clock3, LoaderCircle, TimerOff } from "lucide-react";
import { CurrencyCircleDollarIcon, LightningIcon, ShieldCheckIcon, UsersIcon } from "@phosphor-icons/react/dist/ssr";
import { getApiProviders, getOverviewData } from "@/lib/server/admin-queries";
import { ADMIN_NAV } from "@/lib/mock/nav";
import type { UsagePoint } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { PageHeader, LiveIndicator } from "@/components/admin/PageHeader";
import { HeroFigure, MiniStat, Panel } from "@/components/admin/Panel";
import { Kpi, KpiStrip, rateTone, signed } from "@/components/admin/KpiStrip";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { AdminToolsGrid, type AdminToolCardData } from "@/components/admin/AdminToolsGrid";
import { TimeSeriesChart } from "@/components/admin/charts/TimeSeriesChart";
import { ColumnChart } from "@/components/admin/charts/ColumnChart";
import { BarList } from "@/components/admin/charts/BarList";
import { ShareBar } from "@/components/admin/charts/ShareBar";
import { Meter } from "@/components/admin/charts/Meter";
import { formatStat, sumOf } from "@/components/admin/charts/format";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { seriesDetail } from "@/components/admin/details";

export const dynamic = "force-dynamic";

const TOOL_DESCRIPTIONS: Record<string, string> = {
  "/admin/users": "Accounts, plans and usage per user",
  "/admin/plans": "Pricing tiers and plan features",
  "/admin/credits": "Balances, spend and manual grants",
  "/admin/promo-codes": "Discount and credit codes",
  "/admin/revenue": "MRR, churn and transactions",
  "/admin/api-costs": "What each API provider costs monthly",
  "/admin/usage": "Tool adoption and activity",
  "/admin/announcements": "Update and offer bar in the app",
  "/admin/system": "Job queue and endpoint health",
  "/admin/settings": "Feature flags and admin team",
};

// Plan tiers are ordered, so they take the ordinal ramp (lightest = entry tier).
// Free isn't a tier on the ramp, so it stays neutral gray.
const TIER_COLOR: Record<string, string> = {
  free: "var(--viz-neutral)",
  core: "var(--viz-tier-1)",
  pro: "var(--viz-tier-2)",
  scale: "var(--viz-tier-3)",
};

export default async function AdminOverviewPage() {
  const [overview, apiProviders] = await Promise.all([getOverviewData(), getApiProviders()]);
  const {
    totalUsers,
    signupSeries,
    usageSeries,
    toolUsageShare,
    planDistribution,
    activityLog,
    systemJobs,
    jobSuccessRatePct,
    creditsOutstanding,
    creditsSpentToday,
    activePromoCodes,
    enabledFeatureFlags,
    currentMrr,
    payingUsers,
    activeTrials,
  } = overview;

  const apiMonthlySpend = apiProviders.filter((p) => p.isActive).reduce((sum, p) => sum + p.monthlyCost, 0);

  const dates = signupSeries.map((p) => p.date);
  const signups = signupSeries.map((p) => p.signups);
  const signups30d = sumOf(signups);

  // Every tool the usage log knows about, not a hand-kept subset.
  const toolKeys = toolUsageShare.map((t) => t.tool);
  const runsOn = (p: UsagePoint) => toolKeys.reduce((s, k) => s + p[k], 0);
  const dailyRuns = usageSeries.map(runsOn);
  const runs30d = sumOf(dailyRuns);
  const runsToday = dailyRuns[dailyRuns.length - 1] ?? 0;
  const runsYesterday = dailyRuns[dailyRuns.length - 2] ?? 0;
  const runsChange = runsToday - runsYesterday;


  const paidConversionPct = totalUsers > 0 ? Number(((payingUsers / totalUsers) * 100).toFixed(1)) : 0;

  const jobCounts = {
    success: systemJobs.filter((j) => j.status === "success").length,
    failed: systemJobs.filter((j) => j.status === "failed").length,
    stuck: systemJobs.filter((j) => j.status === "stuck").length,
    running: systemJobs.filter((j) => j.status === "running").length,
    queued: systemJobs.filter((j) => j.status === "queued").length,
  };
  const jobsInFlight = jobCounts.running + jobCounts.queued;

  const TOOL_BADGES: Record<string, Pick<AdminToolCardData, "badge" | "badgeTone">> = {
    "/admin/users": { badge: `${formatNumber(totalUsers)} accounts` },
    "/admin/plans": { badge: `${planDistribution.filter((p) => p.plan !== "free").length} tiers` },
    "/admin/credits": { badge: `${formatNumber(creditsOutstanding)} outstanding` },
    "/admin/promo-codes": { badge: `${activePromoCodes} active`, badgeTone: activePromoCodes > 0 ? "success" : "default" },
    "/admin/revenue":
      currentMrr > 0
        ? { badge: `${formatCurrency(currentMrr)} MRR`, badgeTone: "success" }
        : { badge: "Awaiting first payment", badgeTone: "warning" },
    "/admin/api-costs": { badge: `${formatCurrency(apiMonthlySpend)}/mo` },
    "/admin/usage": { badge: `${formatNumber(runsToday)} runs today` },
    "/admin/system": {
      badge: jobCounts.failed > 0 ? `${jobCounts.failed} failed` : `${jobsInFlight} in flight`,
      badgeTone: jobCounts.failed > 0 ? "danger" : "success",
    },
    "/admin/settings": { badge: `${enabledFeatureFlags} flags on` },
  };

  const toolItems: AdminToolCardData[] = ADMIN_NAV.filter((item) => item.href !== "/admin").map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
    description: TOOL_DESCRIPTIONS[item.href] ?? "",
    ...TOOL_BADGES[item.href],
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Overview" description="Accounts, revenue, product usage and job health across the workspace.">
        <LiveIndicator />
      </PageHeader>

      <KpiStrip>
        <Kpi
          label="MRR"
          value={formatCurrency(currentMrr)}
          icon={CurrencyCircleDollarIcon}
          accent
          footnote={
            currentMrr > 0
              ? `${formatNumber(payingUsers)} paying${activeTrials > 0 ? ` · ${formatNumber(activeTrials)} trialing` : ""}`
              : "Awaiting first payment"
          }
        />
        <Kpi
          label="Total accounts"
          value={formatStat(totalUsers)}
          icon={UsersIcon}
          delta={{ value: signed(signups30d), direction: signups30d > 0 ? "up" : "flat", sentiment: signups30d > 0 ? "positive" : "neutral", label: "last 30 days" }}
        />
        <Kpi
          label="Tool runs today"
          value={formatStat(runsToday)}
          icon={LightningIcon}
          delta={{
            value: signed(runsChange),
            direction: runsChange > 0 ? "up" : runsChange < 0 ? "down" : "flat",
            sentiment: runsChange > 0 ? "positive" : runsChange < 0 ? "negative" : "neutral",
            label: "vs yesterday",
          }}
        />
        <Kpi
          label="Job success rate"
          value={`${jobSuccessRatePct}%`}
          tone={rateTone(jobSuccessRatePct, 90, 70)}
          icon={ShieldCheckIcon}
          delta={{
            value: jobCounts.stuck > 0 ? `${jobCounts.failed} failed · ${jobCounts.stuck} stuck` : `${jobCounts.failed} failed`,
            sentiment: jobCounts.failed + jobCounts.stuck > 0 ? "negative" : "positive",
            label: `of last ${systemJobs.length} jobs`,
          }}
        />
      </KpiStrip>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* The figure is the card's header: "107 runs", the way it's read. */}
        <Panel className="xl:col-span-2" bodyClassName="flex flex-col">
          <HeroFigure
            value={formatStat(runs30d)}
            unit={runs30d === 1 ? "run" : "runs"}
            caption={`Every tool, last 30 days · ${formatNumber(Math.round(runs30d / Math.max(dailyRuns.length, 1)))} a day on average`}
          />
          <TimeSeriesChart dates={dates} series={[{ label: "Tool runs", values: dailyRuns }]} ariaLabel="Tool runs per day, last 30 days" fill />
        </Panel>

        <Panel
          title="Plan mix"
          description={`${formatNumber(sumOf(planDistribution.map((p) => p.count)))} accounts by plan tier`}
          bodyClassName="flex flex-col"
        >
          <ShareBar
            segments={planDistribution.map((p) => ({ label: p.label, value: p.count, color: TIER_COLOR[p.plan] }))}
          />
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-[12px]">
              <span className="text-subtle">Paid conversion</span>
              <span className="font-medium tabular-nums text-heading">{paidConversionPct}%</span>
            </div>
            <Meter value={paidConversionPct} label="Share of accounts on a paid subscription" />
          </div>
          <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
            <MiniStat label="Paying" value={formatStat(payingUsers)} />
            <MiniStat label="Trialing" value={formatStat(activeTrials)} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Signups"
          description={`${formatNumber(signups30d)} new accounts, last 30 days`}
          action={
            <Button href="/admin/users" variant="secondary" size="sm">
              View users
            </Button>
          }
          bodyClassName="flex flex-col"
        >
          <ColumnChart dates={dates} values={signups} label="Signups" ariaLabel="New accounts per day, last 30 days" fill />
        </Panel>

        <Panel
          title="Runs by tool"
          description="Last 30 days, most to least used"
          action={
            <Button href="/admin/usage" variant="secondary" size="sm">
              View usage
            </Button>
          }
        >
          <BarList
            items={[...toolUsageShare]
              .sort((a, b) => b.count - a.count)
              .map((t) => ({
                label: t.label,
                value: t.count,
                detail: seriesDetail({
                  title: t.label,
                  dates: usageSeries.map((p) => p.date),
                  values: usageSeries.map((p) => p[t.tool]),
                  total: runs30d,
                  unit: "runs",
                }),
              }))}
            emptyLabel="No tool runs in the last 30 days"
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Recent activity"
          description="Signups, payments and failed jobs, newest first"
          action={
            <Button href="/admin/system" variant="secondary" size="sm">
              System log
            </Button>
          }
        >
          <ActivityFeed entries={activityLog.slice(0, 7)} />
        </Panel>

        <Panel title="Job pipeline" description={`Last ${systemJobs.length} jobs by status`} bodyClassName="flex flex-col">
          <ShareBar
            emptyLabel="No jobs yet"
            segments={[
              { label: "Succeeded", value: jobCounts.success, color: "var(--viz-good)", icon: <CircleCheck className="h-4 w-4" /> },
              { label: "Failed", value: jobCounts.failed, color: "var(--viz-critical)", icon: <CircleX className="h-4 w-4" /> },
              { label: "Stuck", value: jobCounts.stuck, color: "var(--viz-serious)", icon: <TimerOff className="h-4 w-4" /> },
              { label: "Running", value: jobCounts.running, color: "var(--viz-1)", icon: <LoaderCircle className="h-4 w-4" /> },
              { label: "Queued", value: jobCounts.queued, color: "var(--viz-neutral)", icon: <Clock3 className="h-4 w-4" /> },
            ]}
          />
          <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
            <MiniStat label="Credits outstanding" value={formatStat(creditsOutstanding)} />
            <MiniStat label="Credits spent today" value={formatStat(creditsSpentToday)} />
          </div>
          <Button href="/admin/system" variant="secondary" size="sm" className="mt-4 w-full justify-center">
            Open job queue
          </Button>
        </Panel>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-heading">Admin tools</h2>
        <AdminToolsGrid items={toolItems} />
      </section>
    </div>
  );
}
