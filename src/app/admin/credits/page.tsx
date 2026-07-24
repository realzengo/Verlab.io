import { Coins, TrendingDown, Wallet, Zap } from "lucide-react";
import { getCreditsOverview, getUsersForCreditsAdmin } from "@/lib/server/admin-queries";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/admin/StatTile";
import { ManageUserCreditsCard } from "@/components/admin/ManageUserCreditsCard";
import ProgressMetricCard from "@/components/ui/ProgressMetricCard";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatChartDate } from "@/lib/charts";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage() {
  const [overview, users] = await Promise.all([getCreditsOverview(), getUsersForCreditsAdmin()]);
  const { totalOutstanding, spentToday, spentLast7Days, spentLast30Days, dailySeries, spendByAction, topSpenders, recentTransactions } =
    overview;

  const avgPerDay = spentLast30Days / dailySeries.length;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Credits outstanding" value={formatNumber(totalOutstanding)} icon={Wallet} />
        <StatTile label="Spent today" value={formatNumber(spentToday)} icon={Zap} />
        <StatTile label="Spent (7d)" value={formatNumber(spentLast7Days)} icon={Coins} trend={dailySeries.slice(-7).map((p) => p.spent)} />
        <StatTile label="Spent (30d)" value={formatNumber(spentLast30Days)} icon={TrendingDown} trend={dailySeries.map((p) => p.spent)} />
      </div>

      <ProgressMetricCard
        title="Credits spent per day"
        total={formatNumber(spentLast30Days)}
        deltaLabel="total spent, last 30 days"
        delta={`${formatNumber(Math.round(avgPerDay))}/day avg`}
        showStats={false}
        accent="down"
        data={dailySeries.map((p) => ({ date: formatChartDate(p.date), value: p.spent }))}
        size="lg"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <h3 className="text-sm font-semibold text-heading">Spend by action</h3>
          <p className="mb-5 text-xs text-body">Last 30 days, most to least expensive</p>
          {spendByAction.length === 0 ? (
            <p className="text-sm text-body">No credit spend yet.</p>
          ) : (
            <RankedBarList items={spendByAction.map((a) => ({ label: a.label, value: a.amount, tone: a.tone }))} />
          )}
        </Card>

        <Card className="xl:col-span-2">
          <h3 className="text-sm font-semibold text-heading">Top spenders</h3>
          <p className="mb-4 text-xs text-body">Ranked by credits spent, last 30 days</p>
          {topSpenders.length === 0 ? (
            <EmptyState icon={Coins} title="No spend yet" description="Top spenders will appear once users start using credit-metered tools." />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>User</TableHeaderCell>
                  <TableHeaderCell>Plan</TableHeaderCell>
                  <TableHeaderCell className="text-right">Spent (30d)</TableHeaderCell>
                  <TableHeaderCell className="text-right">Balance</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {topSpenders.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} size="sm" />
                        <span className="truncate font-medium text-heading">{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-body">{u.plan}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(u.spent30d)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(u.balance)}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <ManageUserCreditsCard initialUsers={users} />

      <Card>
        <h3 className="text-sm font-semibold text-heading">Recent transactions</h3>
        <p className="mb-4 text-xs text-body">Latest 50 ledger entries across all users</p>
        {recentTransactions.length === 0 ? (
          <EmptyState icon={Coins} title="No transactions yet" description="Credit charges, refunds, and manual adjustments will show up here." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                <TableHeaderCell>When</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {recentTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
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
                  <TableCell className="text-body">{formatDate(tx.createdAt)}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
