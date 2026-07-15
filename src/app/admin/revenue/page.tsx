import { CreditCard, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import {
  CURRENT_MRR,
  MRR_GROWTH_PCT,
  PAYING_USERS_COUNT,
  PLAN_DISTRIBUTION,
  PLAN_MRR,
  REVENUE_SERIES,
  TRANSACTIONS,
} from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/admin/StatTile";
import { LineAreaChart } from "@/components/charts/LineAreaChart";
import { StackedShareBar } from "@/components/charts/StackedShareBar";
import { TransactionsTable } from "@/components/admin/TransactionsTable";
import { formatNumber } from "@/lib/utils";

export default function AdminRevenuePage() {
  const labels = REVENUE_SERIES.map((p) => p.date);
  const totalNewMrr = REVENUE_SERIES.reduce((s, p) => s + p.newMrr, 0);
  const totalChurnedMrr = REVENUE_SERIES.reduce((s, p) => s + p.churnedMrr, 0);
  const arpu = CURRENT_MRR / PAYING_USERS_COUNT;
  const netNewMrr = totalNewMrr - totalChurnedMrr;

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
          label="New MRR"
          value={`$${formatNumber(totalNewMrr)}`}
          icon={TrendingUp}
          delta={{ value: "30 days", direction: "up", isGood: true, period: "total added" }}
          trend={REVENUE_SERIES.map((p) => p.newMrr)}
        />
        <StatTile
          label="Churned MRR"
          value={`$${formatNumber(totalChurnedMrr)}`}
          icon={TrendingDown}
          delta={{ value: "30 days", direction: "down", isGood: false, period: "total lost" }}
          trend={REVENUE_SERIES.map((p) => p.churnedMrr)}
        />
        <StatTile
          label="ARPU"
          value={`$${arpu.toFixed(2)}`}
          icon={CreditCard}
          delta={{ value: `net +$${formatNumber(netNewMrr)}`, direction: "up", isGood: true, period: "last 30 days" }}
        />
      </div>

      <Card>
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-heading">New vs. churned MRR</h3>
          <p className="text-xs text-body">Daily revenue added and lost, last 30 days</p>
        </div>
        <LineAreaChart
          labels={labels}
          unit="currency"
          series={[
            { key: "new", label: "New MRR", tone: "green", data: REVENUE_SERIES.map((p) => p.newMrr) },
            { key: "churned", label: "Churned MRR", tone: "rose", data: REVENUE_SERIES.map((p) => p.churnedMrr) },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-heading">Revenue by plan</h3>
            <p className="text-xs text-body">Share of {formatNumber(PAYING_USERS_COUNT)} paying accounts</p>
          </div>
          <StackedShareBar segments={PLAN_DISTRIBUTION.map((p) => ({ label: p.label, value: p.count, tone: p.tone }))} />
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-hairline pt-4">
            {PLAN_DISTRIBUTION.map((p) => (
              <div key={p.plan}>
                <p className="text-xs text-body">{p.label} MRR</p>
                <p className="text-sm font-semibold text-heading">${formatNumber(p.count * PLAN_MRR[p.plan])}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-heading">Plan pricing</h3>
          <p className="mb-4 text-xs text-body">Current monthly pricing</p>
          <div className="flex flex-col gap-3">
            {(Object.keys(PLAN_MRR) as (keyof typeof PLAN_MRR)[]).map((plan) => (
              <div key={plan} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2.5">
                <span className="text-sm font-medium capitalize text-heading">{plan}</span>
                <span className="text-sm font-semibold text-heading">${PLAN_MRR[plan]}/mo</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-heading">Recent transactions</h3>
          <p className="text-xs text-body">Latest billing events across all accounts</p>
        </div>
        <TransactionsTable transactions={TRANSACTIONS} />
      </Card>
    </div>
  );
}
