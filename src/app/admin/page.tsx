import { CreditCard, Gauge, Users, Wallet, Wand2 } from "lucide-react";
import { getOverviewData } from "@/lib/server/admin-queries";
import { ADMIN_NAV } from "@/lib/mock/nav";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatTile } from "@/components/admin/StatTile";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { AdminToolsGrid, type AdminToolCardData } from "@/components/admin/AdminToolsGrid";
import ProgressMetricCard from "@/components/ui/ProgressMetricCard";
import { BarChart } from "@/components/charts/BarChart";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { StackedShareBar } from "@/components/charts/StackedShareBar";
import { formatChartDate } from "@/lib/charts";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TOOL_DESCRIPTIONS: Record<string, string> = {
  "/admin/users": "Accounts, plans & usage per user",
  "/admin/plans": "Edit pricing tiers & features",
  "/admin/credits": "Balances, spend & manual grants",
  "/admin/promo-codes": "Discount & referral codes",
  "/admin/revenue": "MRR, churn & transactions",
  "/admin/usage": "Tool adoption & activity",
  "/admin/system": "Job queue & endpoint health",
  "/admin/settings": "Feature flags & admin team",
};

export default async function AdminOverviewPage() {
  const {
    totalUsers: TOTAL_USERS_COUNT,
    signupSeries: SIGNUP_SERIES,
    usageSeries: USAGE_SERIES,
    toolUsageShare: TOOL_USAGE_SHARE,
    planDistribution: PLAN_DISTRIBUTION,
    activityLog: ACTIVITY_LOG,
    systemJobs: SYSTEM_JOBS,
    jobSuccessRatePct: JOB_SUCCESS_RATE_PCT,
    creditsOutstanding: CREDITS_OUTSTANDING,
    creditsSpentToday: CREDITS_SPENT_TODAY,
    activePromoCodes: ACTIVE_PROMO_CODES,
    enabledFeatureFlags: ENABLED_FEATURE_FLAGS,
  } = await getOverviewData();

  const signupLabels = SIGNUP_SERIES.map((p) => p.date);
  const signups30d = SIGNUP_SERIES.reduce((s, p) => s + p.signups, 0);

  const latestUsage = USAGE_SERIES[USAGE_SERIES.length - 1];
  const previousUsage = USAGE_SERIES[USAGE_SERIES.length - 2];
  const sumTools = (p: (typeof USAGE_SERIES)[number]) => p.bend + p.niches + p.transcripts + p.downloader + p.mcp + p.image;
  const toolRunsToday = sumTools(latestUsage);
  const toolRunsYesterday = previousUsage ? sumTools(previousUsage) : 0;

  const jobsQueued = SYSTEM_JOBS.filter((j) => j.status === "queued" || j.status === "running").length;
  const jobsFailed = SYSTEM_JOBS.filter((j) => j.status === "failed").length;

  // Cumulative account count over the trailing 30 days, anchored so the
  // curve ends exactly at today's real total — no fabricated pre-window data.
  const baseUsers = TOTAL_USERS_COUNT - signups30d;
  const growthSeries = SIGNUP_SERIES.reduce<{ date: string; value: number }[]>((acc, p) => {
    const prev = acc[acc.length - 1]?.value ?? baseUsers;
    acc.push({ date: formatChartDate(p.date), value: prev + p.signups });
    return acc;
  }, []);

  const TOOL_BADGES: Record<string, { badge: string; badgeTone?: AdminToolCardData["badgeTone"] }> = {
    "/admin/users": { badge: `${formatNumber(TOTAL_USERS_COUNT)} total` },
    "/admin/plans": { badge: `${PLAN_DISTRIBUTION.length} tiers` },
    "/admin/credits": { badge: `${formatNumber(CREDITS_OUTSTANDING)} outstanding` },
    "/admin/promo-codes": {
      badge: `${ACTIVE_PROMO_CODES} active`,
      badgeTone: ACTIVE_PROMO_CODES > 0 ? "success" : "default",
    },
    "/admin/revenue": { badge: "Not connected", badgeTone: "warning" },
    "/admin/usage": { badge: `${formatNumber(toolRunsToday)} runs today` },
    "/admin/system": {
      badge: jobsFailed > 0 ? `${jobsFailed} failed` : `${jobsQueued} in flight`,
      badgeTone: jobsFailed > 0 ? "danger" : "default",
    },
    "/admin/settings": { badge: `${ENABLED_FEATURE_FLAGS} flags on` },
  };

  const toolItems: AdminToolCardData[] = ADMIN_NAV.filter((item) => item.href !== "/admin").map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
    description: TOOL_DESCRIPTIONS[item.href] ?? "",
    ...TOOL_BADGES[item.href],
  }));

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-body">Real-time snapshot of accounts, usage, and job health across the workspace.</p>
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-subtle">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          Live data
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total users"
          value={formatNumber(TOTAL_USERS_COUNT)}
          icon={Users}
          tone="blue"
          delta={{ value: `+${signups30d}`, direction: "up", isGood: true, period: "last 30 days" }}
          trend={SIGNUP_SERIES.map((p) => p.signups)}
        />
        <StatTile
          label="Tool runs today"
          value={formatNumber(toolRunsToday)}
          icon={Wand2}
          tone="violet"
          delta={{
            value: `${toolRunsToday - toolRunsYesterday >= 0 ? "+" : ""}${toolRunsToday - toolRunsYesterday}`,
            direction: toolRunsToday >= toolRunsYesterday ? "up" : "down",
            isGood: toolRunsToday >= toolRunsYesterday,
            period: "vs yesterday",
          }}
          trend={USAGE_SERIES.slice(-14).map((p) => sumTools(p))}
        />
        <StatTile
          label="Job success rate"
          value={`${JOB_SUCCESS_RATE_PCT}%`}
          icon={Gauge}
          tone="green"
          delta={{
            value: `${jobsFailed} failed`,
            direction: jobsFailed > 0 ? "down" : "up",
            isGood: jobsFailed === 0,
            period: "recent jobs",
          }}
        />
        <StatTile
          label="Credits outstanding"
          value={formatNumber(CREDITS_OUTSTANDING)}
          icon={Wallet}
          tone="amber"
          delta={{ value: `${formatNumber(CREDITS_SPENT_TODAY)} spent`, direction: "down", isGood: true, period: "today" }}
        />
      </div>

      <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-tint text-warning">
            <CreditCard className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-heading">Billing isn&apos;t connected yet</p>
            <p className="text-xs text-body">Connect a payment provider to unlock MRR, churn, and transaction reporting here.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button href="/admin/plans" variant="secondary" size="sm">
            Edit pricing
          </Button>
          <Button href="/admin/revenue" variant="ghost" size="sm">
            View revenue
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ProgressMetricCard
            title="User growth"
            total={formatNumber(TOTAL_USERS_COUNT)}
            delta={`+${signups30d}`}
            deltaLabel="new accounts, last 30 days"
            data={growthSeries}
            format="number"
            size="lg"
          />
        </div>

        <Card>
          <h3 className="text-sm font-semibold text-heading">Plan distribution</h3>
          <p className="mb-5 text-xs text-body">{formatNumber(PLAN_DISTRIBUTION.reduce((s, p) => s + p.count, 0))} accounts by plan tier</p>
          <StackedShareBar segments={PLAN_DISTRIBUTION.map((p) => ({ label: p.label, value: p.count, tone: p.tone }))} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-heading">Signups</h3>
              <p className="text-xs text-body">Daily new accounts, last 30 days</p>
            </div>
          </div>
          <BarChart labels={signupLabels} data={SIGNUP_SERIES.map((p) => p.signups)} tone="blue" />
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-heading">Tool usage (30d)</h3>
          <p className="mb-5 text-xs text-body">Runs by tool, most to least used</p>
          <RankedBarList
            items={[...TOOL_USAGE_SHARE].sort((a, b) => b.count - a.count).map((t) => ({ label: t.label, value: t.count, tone: t.tone }))}
          />
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-heading">Admin tools</h3>
        <AdminToolsGrid items={toolItems} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-heading">Recent activity</h3>
            <Button href="/admin/system" variant="text" size="sm">
              View system log
            </Button>
          </div>
          <ActivityFeed entries={ACTIVITY_LOG.slice(0, 7)} />
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
              <Gauge className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-heading">Job pipeline</h3>
              <p className="text-xs text-body">Niche Bend, SOP & transcript jobs</p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-body">In progress</span>
              <Badge variant="default">{jobsQueued} running</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-body">Failed today</span>
              <Badge variant={jobsFailed > 0 ? "danger" : "success"}>{jobsFailed}</Badge>
            </div>
          </div>
          <Button href="/admin/system" variant="secondary" size="sm" icon={Wand2}>
            Open job queue
          </Button>
        </Card>
      </div>
    </div>
  );
}
