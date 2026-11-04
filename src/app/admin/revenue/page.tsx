import { TriangleAlert } from "lucide-react";
import { getRevenueData } from "@/lib/server/admin-queries";
import { PageHeader, LiveIndicator } from "@/components/admin/PageHeader";
import { Callout, HeroFigure, MiniStat, Panel } from "@/components/admin/Panel";
import { Kpi, KpiStrip, signed } from "@/components/admin/KpiStrip";
import { formatStat } from "@/components/admin/charts/format";
import { RevenueTransactionsTable } from "@/components/admin/RevenueTransactionsTable";
import { TimeSeriesChart } from "@/components/admin/charts/TimeSeriesChart";
import { ShareBar } from "@/components/admin/charts/ShareBar";
import { BarList } from "@/components/admin/charts/BarList";
import { Meter } from "@/components/admin/charts/Meter";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TIER_COLOR: Record<string, string> = {
  core: "var(--viz-tier-1)",
  pro: "var(--viz-tier-2)",
  scale: "var(--viz-tier-3)",
};

export default async function AdminRevenuePage() {
  const {
    mrr,
    arr,
    arpu,
    activeSubscribers,
    trialingCount,
    pastDueCount,
    churnedLast30d,
    newSubscribersLast30d,
    churnRatePct,
    netCollectedLast30d,
    planBreakdown,
    dailySeries,
    recentTransactions,
    webhookConfigured,
    cancellationBreakdown,
    retentionOffersShown,
    retentionOfferAcceptRatePct,
  } = await getRevenueData();

  const netSubscribers = newSubscribersLast30d - churnedLast30d;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Revenue" description="MRR, subscribers and transactions, straight from Whop billing.">
        <LiveIndicator />
      </PageHeader>

      {!webhookConfigured && (
        <Callout icon={<TriangleAlert className="h-4 w-4" />} title="The Whop webhook isn't registered yet">
          Checkout, MRR and subscriber status only update from Whop&apos;s webhook. Everything below stays at zero until{" "}
          <code className="rounded bg-(--admin-fill-strong) px-1 py-0.5 font-mono text-[12px]">WHOP_WEBHOOK_SECRET</code> is set
          and <code className="rounded bg-(--admin-fill-strong) px-1 py-0.5 font-mono text-[12px]">/api/webhooks/whop</code> is
          registered against a public URL.
        </Callout>
      )}

      <KpiStrip>
        <Kpi label="Monthly recurring revenue" value={formatCurrency(mrr)} footnote={`${formatCurrency(arr)} annualized`} />
        <Kpi
          label="Active subscribers"
          value={formatStat(activeSubscribers)}
          delta={{
            value: signed(newSubscribersLast30d),
            direction: newSubscribersLast30d > 0 ? "up" : "flat",
            sentiment: newSubscribersLast30d > 0 ? "positive" : "neutral",
            label: "new, last 30 days",
          }}
        />
        <Kpi label="ARPU" value={formatCurrency(arpu)} footnote="per subscriber, monthly" />
        <Kpi
          label="Churn rate"
          value={`${churnRatePct}%`}
          delta={{
            value: `${churnedLast30d} canceled`,
            sentiment: churnedLast30d > 0 ? "negative" : "positive",
            label: "last 30 days",
          }}
        />
      </KpiStrip>

      <Panel title="Revenue collected" description="Payments net of refunds, per day">
        <HeroFigure value={formatCurrency(netCollectedLast30d)} caption="Collected in the last 30 days" />
        <TimeSeriesChart
          dates={dailySeries.map((p) => p.date)}
          series={[{ label: "Collected", values: dailySeries.map((p) => p.collected) }]}
          format="currency"
          height={240}
          ariaLabel="Revenue collected per day, last 30 days"
        />
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="MRR by plan" description="Monthly-normalized, active subscribers">
          <ShareBar
            format="currency"
            emptyLabel="No paying subscribers yet"
            segments={planBreakdown.map((p) => ({
              label: p.label,
              value: p.mrr,
              color: TIER_COLOR[p.plan],
              detail: `${p.subscriberCount} sub${p.subscriberCount === 1 ? "" : "s"}`,
            }))}
          />
        </Panel>

        <Panel className="xl:col-span-2" title="Subscriber health" description="Trials, at-risk renewals and churn this period">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="Trialing" value={formatStat(trialingCount)} hint="Not yet billed" />
            <MiniStat label="New (30d)" value={formatStat(newSubscribersLast30d)} hint={`Net ${signed(netSubscribers)} after churn`} />
            <MiniStat
              label="Past due"
              value={formatStat(pastDueCount)}
              hint="In the grace window"
              tone={pastDueCount > 0 ? "warning" : "default"}
            />
            <MiniStat
              label="Canceled (30d)"
              value={formatStat(churnedLast30d)}
              hint={`${churnRatePct}% churn`}
              tone={churnedLast30d > 0 ? "critical" : "default"}
            />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Cancellation reasons" description="From subscribers who finished the exit survey">
          <BarList
            items={cancellationBreakdown.map((r) => ({ label: r.label, value: r.count })).sort((a, b) => b.value - a.value)}
            emptyLabel="No cancellations recorded yet"
          />
        </Panel>

        <Panel title="Retention offer" description="7 free days, shown before a cancellation is final" bodyClassName="flex flex-col">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Shown" value={formatStat(retentionOffersShown)} />
            <MiniStat label="Accepted" value={`${retentionOfferAcceptRatePct}%`} />
          </div>
          <div className="mt-auto pt-5">
            <div className="mb-2 flex items-center justify-between text-[12px]">
              <span className="text-subtle">Save rate</span>
              <span className="font-medium tabular-nums text-heading">{retentionOfferAcceptRatePct}%</span>
            </div>
            <Meter value={retentionOfferAcceptRatePct} label="Retention offer acceptance rate" />
          </div>
        </Panel>
      </div>

      <RevenueTransactionsTable transactions={recentTransactions} />
    </div>
  );
}
