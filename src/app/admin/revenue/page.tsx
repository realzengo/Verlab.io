import { AlertTriangle, DollarSign, LifeBuoy, Percent, UserPlus, Users, Wallet } from "lucide-react";
import { getRevenueData } from "@/lib/server/admin-queries";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/admin/StatTile";
import ProgressMetricCard from "@/components/ui/ProgressMetricCard";
import { StackedShareBar } from "@/components/charts/StackedShareBar";
import { RevenueTransactionsTable } from "@/components/admin/RevenueTransactionsTable";
import { formatChartDate } from "@/lib/charts";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminRevenuePage() {
  const {
    mrr: MRR,
    arr: ARR,
    arpu: ARPU,
    activeSubscribers: ACTIVE_SUBSCRIBERS,
    trialingCount: TRIALING_COUNT,
    pastDueCount: PAST_DUE_COUNT,
    churnedLast30d: CHURNED_LAST_30D,
    newSubscribersLast30d: NEW_SUBSCRIBERS_LAST_30D,
    churnRatePct: CHURN_RATE_PCT,
    netCollectedLast30d: NET_COLLECTED_LAST_30D,
    planBreakdown: PLAN_BREAKDOWN,
    dailySeries: DAILY_SERIES,
    recentTransactions: RECENT_TRANSACTIONS,
    webhookConfigured: WEBHOOK_CONFIGURED,
    cancellationBreakdown: CANCELLATION_BREAKDOWN,
    retentionOffersShown: RETENTION_OFFERS_SHOWN,
    retentionOfferAcceptRatePct: RETENTION_OFFER_ACCEPT_RATE_PCT,
  } = await getRevenueData();

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-body">Live MRR, subscriber, and transaction data straight from Whop billing.</p>
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-subtle">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          Live data
        </div>
      </div>

      {!WEBHOOK_CONFIGURED && (
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-tint text-warning">
            <AlertTriangle className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-heading">Whop webhook isn&apos;t registered yet</p>
            <p className="text-xs text-body">
              Checkout, MRR, and subscriber status only update from Whop&apos;s webhook. Everything below stays at
              zero until <code className="rounded bg-surface px-1 py-0.5 text-[11px]">WHOP_WEBHOOK_SECRET</code> is
              set and <code className="rounded bg-surface px-1 py-0.5 text-[11px]">/api/webhooks/whop</code> is
              registered against a public URL.
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Monthly recurring revenue"
          value={formatCurrency(MRR)}
          icon={DollarSign}
          tone="blue"
          delta={{ value: `${formatCurrency(ARR)} ARR`, direction: "up", isGood: true, period: "annualized" }}
        />
        <StatTile
          label="Active subscribers"
          value={formatNumber(ACTIVE_SUBSCRIBERS)}
          icon={Users}
          tone="violet"
          delta={{
            value: `+${NEW_SUBSCRIBERS_LAST_30D} new`,
            direction: "up",
            isGood: true,
            period: "last 30 days",
          }}
        />
        <StatTile label="ARPU" value={formatCurrency(ARPU)} icon={Wallet} tone="green" />
        <StatTile
          label="Churn rate"
          value={`${CHURN_RATE_PCT}%`}
          icon={Percent}
          tone="amber"
          delta={{
            value: `${CHURNED_LAST_30D} canceled`,
            direction: CHURNED_LAST_30D > 0 ? "down" : "up",
            isGood: CHURNED_LAST_30D === 0,
            period: "last 30 days",
          }}
        />
      </div>

      <ProgressMetricCard
        title="Revenue collected"
        total={formatCurrency(NET_COLLECTED_LAST_30D)}
        deltaLabel="collected, last 30 days"
        format="currency"
        data={DAILY_SERIES.map((p) => ({ date: formatChartDate(p.date), value: p.collected }))}
        size="lg"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <h3 className="text-sm font-semibold text-heading">MRR by plan</h3>
          <p className="mb-5 text-xs text-body">Active subscribers, monthly-normalized</p>
          <StackedShareBar
            unit="currency"
            segments={PLAN_BREAKDOWN.map((p) => ({
              label: `${p.label} · ${p.subscriberCount} sub${p.subscriberCount === 1 ? "" : "s"}`,
              value: p.mrr,
              tone: p.tone,
            }))}
          />
        </Card>

        <Card className="flex flex-col gap-4 xl:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
              <UserPlus className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-heading">Subscriber health</h3>
              <p className="text-xs text-body">Trials, at-risk renewals, and churn this period</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-chip border border-hairline p-4">
              <p className="text-xs text-body">Trialing</p>
              <p className="mt-1 text-xl font-semibold text-heading">{formatNumber(TRIALING_COUNT)}</p>
            </div>
            <div className="rounded-chip border border-hairline p-4">
              <p className="text-xs text-body">Past due (at risk)</p>
              <p className="mt-1 text-xl font-semibold text-heading">{formatNumber(PAST_DUE_COUNT)}</p>
            </div>
            <div className="rounded-chip border border-hairline p-4">
              <p className="text-xs text-body">Canceled (30d)</p>
              <p className="mt-1 text-xl font-semibold text-heading">{formatNumber(CHURNED_LAST_30D)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h3 className="text-sm font-semibold text-heading">Cancellation reasons</h3>
          <p className="mb-5 text-xs text-body">Why subscribers who finished the exit survey actually canceled</p>
          {CANCELLATION_BREAKDOWN.length > 0 ? (
            <StackedShareBar segments={CANCELLATION_BREAKDOWN.map((r) => ({ label: r.label, value: r.count, tone: r.tone }))} />
          ) : (
            <p className="text-sm text-body">No cancellations recorded yet.</p>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
              <LifeBuoy className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-heading">Retention offer</h3>
              <p className="text-xs text-body">7 free days, shown before a cancellation is finalized</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-chip border border-hairline p-4">
              <p className="text-xs text-body">Shown</p>
              <p className="mt-1 text-xl font-semibold text-heading">{formatNumber(RETENTION_OFFERS_SHOWN)}</p>
            </div>
            <div className="rounded-chip border border-hairline p-4">
              <p className="text-xs text-body">Accepted</p>
              <p className="mt-1 text-xl font-semibold text-heading">{RETENTION_OFFER_ACCEPT_RATE_PCT}%</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-heading">Recent transactions</h3>
            <p className="text-xs text-body">Payments and refunds from Whop, most recent first</p>
          </div>
        </div>
        <RevenueTransactionsTable transactions={RECENT_TRANSACTIONS} />
      </Card>
    </div>
  );
}
