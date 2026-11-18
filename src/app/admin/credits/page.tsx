import { CalendarDotsIcon, CoinsIcon, FireIcon, GiftIcon } from "@phosphor-icons/react/dist/ssr";
import { getCreditsOverview, getUsersForCreditsAdmin } from "@/lib/server/admin-queries";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { PageHeader } from "@/components/admin/PageHeader";
import { HeroFigure, Panel } from "@/components/admin/Panel";
import { Kpi, KpiStrip } from "@/components/admin/KpiStrip";
import { ManageUserCreditsCard } from "@/components/admin/ManageUserCreditsCard";
import { CreditLedgerTable } from "@/components/admin/CreditLedgerTable";
import { TimeSeriesChart } from "@/components/admin/charts/TimeSeriesChart";
import { BarList } from "@/components/admin/charts/BarList";
import { formatStat, sumOf } from "@/components/admin/charts/format";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage() {
  const [overview, users] = await Promise.all([getCreditsOverview(), getUsersForCreditsAdmin()]);
  const { totalOutstanding, spentToday, spentLast7Days, spentLast30Days, dailySeries, spendByAction, topSpenders, recentTransactions } =
    overview;

  const granted = dailySeries.map((p) => p.granted);
  const avgPerDay = spentLast30Days / Math.max(dailySeries.length, 1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Credits" description="Balances, daily spend and manual grants across every account." />

      <KpiStrip>
        <Kpi label="Outstanding" value={formatStat(totalOutstanding)} footnote="across all balances" icon={CoinsIcon} accent />
        <Kpi label="Spent today" value={formatStat(spentToday)} icon={FireIcon} footnote="credits charged so far" />
        <Kpi label="Spent, 7 days" value={formatStat(spentLast7Days)} icon={CalendarDotsIcon} />
        <Kpi label="Granted, 30 days" value={formatStat(sumOf(granted))} icon={GiftIcon} />
      </KpiStrip>

      {/* The figure is the card's header: "8,760 credits spent". */}
      <Panel>
        <HeroFigure
          value={formatStat(spentLast30Days)}
          unit="credits spent"
          caption={`Every credit-metered tool, last 30 days · ${formatNumber(Math.round(avgPerDay))} a day on average`}
        />
        <TimeSeriesChart
          dates={dailySeries.map((p) => p.date)}
          series={[{ label: "Credits spent", values: dailySeries.map((p) => p.spent) }]}
          ariaLabel="Credits spent per day, last 30 days"
        />
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Spend by action" description="Last 30 days, most to least credits">
          <BarList
            items={spendByAction.map((a) => {
              const total = sumOf(spendByAction.map((x) => x.amount));
              return {
                label: a.label,
                value: a.amount,
                detail: {
                  title: a.label,
                  subtitle: "Last 30 days",
                  rows: [
                    { label: "Credits spent", value: a.amount.toLocaleString("en-US") },
                    { label: "Share of all spend", value: total > 0 ? `${Math.round((a.amount / total) * 100)}%` : "0%" },
                    { label: "Daily average", value: Math.round(a.amount / Math.max(dailySeries.length, 1)).toLocaleString("en-US") },
                    { label: "Action key", value: a.actionKey, mono: true },
                  ],
                },
              };
            })}
            emptyLabel="No credit spend yet"
          />
        </Panel>

        <Panel className="xl:col-span-2" title="Top spenders" description="Ranked by credits spent, last 30 days" flush>
          {topSpenders.length === 0 ? (
            <p className="border-t border-hairline px-5 py-12 text-center text-[13px] text-subtle">
              Top spenders appear once people start using credit-metered tools.
            </p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell className="pl-5">User</TableHeaderCell>
                  <TableHeaderCell>Plan</TableHeaderCell>
                  <TableHeaderCell className="text-right">Spent (30d)</TableHeaderCell>
                  <TableHeaderCell className="pr-5 text-right">Balance</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {topSpenders.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={u.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-heading">{u.name}</p>
                          <p className="truncate text-xs text-subtle">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-body">{u.plan}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatNumber(u.spent30d)}</TableCell>
                    <TableCell className="pr-5 text-right tabular-nums text-body">{formatNumber(u.balance)}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      <ManageUserCreditsCard initialUsers={users} />

      <CreditLedgerTable entries={recentTransactions} />
    </div>
  );
}
