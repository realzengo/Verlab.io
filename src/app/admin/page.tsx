import { Activity, DollarSign, TrendingDown, UserPlus, Users, Wand2 } from "lucide-react";
import {
  ACTIVITY_LOG,
  CHURN_RATE_PCT,
  CURRENT_MRR,
  JOB_SUCCESS_RATE_PCT,
  MRR_GROWTH_PCT,
  PLAN_DISTRIBUTION,
  PREVIOUS_CHURN_RATE_PCT,
  PREVIOUS_MRR,
  REVENUE_SERIES,
  SIGNUP_SERIES,
  SYSTEM_JOBS,
  TOOL_USAGE_SHARE,
  USAGE_SERIES,
  ACTIVE_TRIALS_COUNT,
  TOTAL_USERS_COUNT,
} from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatTile } from "@/components/admin/StatTile";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import ProgressMetricCard from "@/components/ui/ProgressMetricCard";
import { BarChart } from "@/components/charts/BarChart";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { StackedShareBar } from "@/components/charts/StackedShareBar";
import { formatChartDate } from "@/lib/charts";
import { formatNumber } from "@/lib/utils";

export default function AdminOverviewPage() {
  const signupLabels = SIGNUP_SERIES.map((p) => p.date);
  const latestUsage = USAGE_SERIES[USAGE_SERIES.length - 1];
  const toolRunsToday = latestUsage.bend + latestUsage.niches + latestUsage.transcripts + latestUsage.downloader + latestUsage.mcp;
  const jobsQueued = SYSTEM_JOBS.filter((j) => j.status === "queued" || j.status === "running").length;
  const jobsFailed = SYSTEM_JOBS.filter((j) => j.status === "failed").length;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Monthly recurring revenue"
          value={`$${formatNumber(CURRENT_MRR)}`}
          icon={DollarSign}
          delta={{ value: `${MRR_GROWTH_PCT}%`, direction: MRR_GROWTH_PCT >= 0 ? "up" : "down", isGood: MRR_GROWTH_PCT >= 0, period: "vs last week" }}
          trend={REVENUE_SERIES.map((p) => p.mrr)}
        />
        <StatTile
          label="Total users"
          value={formatNumber(TOTAL_USERS_COUNT)}
          icon={Users}
          delta={{ value: `+${SIGNUP_SERIES.reduce((s, p) => s + p.signups, 0)}`, direction: "up", isGood: true, period: "last 30 days" }}
          trend={SIGNUP_SERIES.map((p) => p.signups)}
        />
        <StatTile
          label="Active trials"
          value={formatNumber(ACTIVE_TRIALS_COUNT)}
          icon={UserPlus}
          delta={{ value: `${SIGNUP_SERIES[SIGNUP_SERIES.length - 1].trials}`, direction: "up", isGood: true, period: "started today" }}
          trend={SIGNUP_SERIES.map((p) => p.trials)}
        />
        <StatTile
          label="Churn rate"
          value={`${CHURN_RATE_PCT}%`}
          icon={TrendingDown}
          delta={{
            value: `${Math.abs(CHURN_RATE_PCT - PREVIOUS_CHURN_RATE_PCT).toFixed(1)}pp`,
            direction: CHURN_RATE_PCT < PREVIOUS_CHURN_RATE_PCT ? "down" : "up",
            isGood: CHURN_RATE_PCT < PREVIOUS_CHURN_RATE_PCT,
            period: "vs last month",
          }}
          trend={REVENUE_SERIES.map((p) => p.churnedMrr)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ProgressMetricCard
            title="Revenue trend"
            total={`$${formatNumber(CURRENT_MRR)}`}
            delta={`${CURRENT_MRR - PREVIOUS_MRR >= 0 ? "+" : "−"}$${formatNumber(Math.abs(CURRENT_MRR - PREVIOUS_MRR))}`}
            deltaLabel="vs last week"
            percent={`${Math.abs(MRR_GROWTH_PCT)}%`}
            trend={MRR_GROWTH_PCT >= 0 ? "up" : "down"}
            data={REVENUE_SERIES.map((p) => ({ date: formatChartDate(p.date), value: p.mrr }))}
            format="currency"
            size="lg"
          />
        </div>

        <Card>
          <h3 className="text-sm font-semibold text-heading">Plan distribution</h3>
          <p className="mb-5 text-xs text-body">{formatNumber(PLAN_DISTRIBUTION.reduce((s, p) => s + p.count, 0))} paying accounts</p>
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
              <Activity className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-heading">Job pipeline</h3>
              <p className="text-xs text-body">Niche Bend, SOP & transcript jobs</p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-body">Success rate</span>
              <span className="font-semibold text-heading">{JOB_SUCCESS_RATE_PCT}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-body">In progress</span>
              <Badge variant="default">{jobsQueued} running</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-body">Failed today</span>
              <Badge variant={jobsFailed > 0 ? "danger" : "success"}>{jobsFailed}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-body">Tool runs today</span>
              <span className="font-semibold text-heading">{formatNumber(toolRunsToday)}</span>
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
