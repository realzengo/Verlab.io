import { TriangleAlert } from "lucide-react";
import { CurrencyCircleDollarIcon, TrendDownIcon, UserIcon, UsersIcon } from "@phosphor-icons/react/dist/ssr";
import { getRevenueData } from "@/lib/server/admin-queries";
import { PageHeader, LiveIndicator } from "@/components/admin/PageHeader";
import { Callout, HeroFigure, MiniStat, Panel } from "@/components/admin/Panel";
import { Kpi, KpiStrip, rateTone, signed } from "@/components/admin/KpiStrip";
import { formatStat, sumOf } from "@/components/admin/charts/format";
import { RevenueTransactionsTable } from "@/components/admin/RevenueTransactionsTable";
import { FailedPaymentsTable } from "@/components/admin/FailedPaymentsTable";
import { TimeSeriesChart } from "@/components/admin/charts/TimeSeriesChart";
import { ShareBar } from "@/components/admin/charts/ShareBar";
import { BarList } from "@/components/admin/charts/BarList";
import { Meter } from "@/components/admin/charts/Meter";
import { formatCurrency } from "@/lib/utils";
import { shareDetail } from "@/components/admin/details";

/** Cents shown, like the Whop dashboard: $23.62, not $24. */
const formatMoney = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    failedPayments,
    webhookConfigured,
    webhookEnabled,
    whopBalance,
    moneySource,
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

      {webhookConfigured && webhookEnabled === false && (
        <Callout icon={<TriangleAlert className="h-4 w-4" />} title="Whop has switched the webhook off">
          Whop disables an endpoint after repeated failed deliveries. The sync job turns it back on and catches up
          payments every 10 minutes, so this should clear by itself; if it stays, check the webhook in Whop&apos;s
          developer settings.
        </Callout>
      )}

      <KpiStrip>
        <Kpi
          label="MRR"
          value={formatCurrency(mrr)}
          footnote={`${formatCurrency(arr)} annualized`}
          icon={CurrencyCircleDollarIcon}
          accent
        />
        <Kpi
          label="Active subscribers"
          value={formatStat(activeSubscribers)}
          icon={UsersIcon}
          delta={{
            value: signed(newSubscribersLast30d),
            direction: newSubscribersLast30d > 0 ? "up" : "flat",
            sentiment: newSubscribersLast30d > 0 ? "positive" : "neutral",
            label: "new, last 30 days",
          }}
        />
        <Kpi label="ARPU" value={formatCurrency(arpu)} footnote="per subscriber, monthly" icon={UserIcon} />
        <Kpi
          label="Churn rate"
          value={`${churnRatePct}%`}
          tone={rateTone(churnRatePct, 0, 5, false)}
          icon={TrendDownIcon}
          delta={{
            value: `${churnedLast30d} canceled`,
            sentiment: churnedLast30d > 0 ? "negative" : "positive",
            label: "last 30 days",
          }}
        />
      </KpiStrip>

      {/* The figure is the card's header, with the Whop balance across from it. */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <HeroFigure
            value={formatMoney(netCollectedLast30d)}
            unit="collected"
            caption={
              moneySource === "whop"
                ? "Last 30 days, after Whop's fees and refunds"
                : "Last 30 days · Whop couldn't be reached, so this is what the webhook recorded"
            }
          />
          {whopBalance && (
            <div className="text-left sm:text-right">
              <p className="text-[12px] text-subtle">Whop balance</p>
              <p className="text-lg font-semibold tabular-nums tracking-[-0.01em] text-heading">{formatMoney(whopBalance.total)}</p>
              <p className="text-[12px] tabular-nums text-subtle">
                {formatMoney(whopBalance.available)} available · {formatMoney(whopBalance.pending)} pending
              </p>
            </div>
          )}
        </div>
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

        <Panel
          className="xl:col-span-2"
          title="Subscriber health"
          description="Trials, at-risk renewals and churn this period"
          bodyClassName="flex flex-col"
        >
          <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
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
        <Panel
          className="xl:col-span-2"
          title="Cancellation reasons"
          description="From subscribers who finished the exit survey"
          bodyClassName="flex flex-col"
        >
          <BarList
            items={cancellationBreakdown
              .map((r) => ({
                label: r.label,
                value: r.count,
                detail: shareDetail(r.label, r.count, sumOf(cancellationBreakdown.map((x) => x.count)), "Cancellations"),
              }))
              .sort((a, b) => b.value - a.value)}
            emptyLabel="No cancellations recorded yet"
            fill
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

      <FailedPaymentsTable payments={failedPayments} />

      <RevenueTransactionsTable transactions={recentTransactions} />
    </div>
  );
}
