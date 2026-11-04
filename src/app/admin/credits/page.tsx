import { getCreditsOverview, getUsersForCreditsAdmin } from "@/lib/server/admin-queries";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeader } from "@/components/admin/PageHeader";
import { HeroFigure, Panel } from "@/components/admin/Panel";
import { Kpi, KpiStrip } from "@/components/admin/KpiStrip";
import { ManageUserCreditsCard } from "@/components/admin/ManageUserCreditsCard";
import { TimeSeriesChart } from "@/components/admin/charts/TimeSeriesChart";
import { BarList } from "@/components/admin/charts/BarList";
import { formatStat, sumOf } from "@/components/admin/charts/format";
import { formatDate, formatNumber } from "@/lib/utils";

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
        <Kpi label="Outstanding" value={formatStat(totalOutstanding)} footnote="across all balances" />
        <Kpi label="Spent today" value={formatStat(spentToday)} />
        <Kpi label="Spent, 7 days" value={formatStat(spentLast7Days)} trend={dailySeries.slice(-7).map((p) => p.spent)} />
        <Kpi label="Granted, 30 days" value={formatStat(sumOf(granted))} trend={granted.slice(-14)} />
      </KpiStrip>

      <Panel title="Credits spent" description="Charged across every credit-metered tool, per day">
        <HeroFigure value={formatStat(spentLast30Days)} caption={`Spent in the last 30 days · ${formatNumber(Math.round(avgPerDay))} a day on average`} />
        <TimeSeriesChart
          dates={dailySeries.map((p) => p.date)}
          series={[{ label: "Credits spent", values: dailySeries.map((p) => p.spent) }]}
          ariaLabel="Credits spent per day, last 30 days"
        />
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Spend by action" description="Last 30 days, most to least credits">
          <BarList items={spendByAction.map((a) => ({ label: a.label, value: a.amount }))} emptyLabel="No credit spend yet" />
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
                        <Avatar name={u.name} size="sm" />
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

      <Panel title="Ledger" description="Latest 50 entries across all users" flush>
        {recentTransactions.length === 0 ? (
          <p className="border-t border-hairline px-5 py-12 text-center text-[13px] text-subtle">
            Credit charges, refunds and manual adjustments will show up here.
          </p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="pl-5">User</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                <TableHeaderCell className="pr-5 text-right">When</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {recentTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={tx.userName} size="sm" />
                      <span className="truncate font-medium text-heading">{tx.userName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-body">
                    {tx.feature}
                    {tx.grantedBy && <span className="ml-1.5 text-xs text-subtle">by {tx.grantedBy}</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={tx.amount < 0 ? "danger" : "success"}>
                      {tx.amount < 0 ? "−" : "+"}
                      {formatNumber(Math.abs(tx.amount))}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap pr-5 text-right text-body">{formatDate(tx.createdAt)}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
