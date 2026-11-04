import { getAdminUsers, getUsageData } from "@/lib/server/admin-queries";
import type { UsagePoint } from "@/lib/types";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { Kpi, KpiStrip } from "@/components/admin/KpiStrip";
import { ColumnChart } from "@/components/admin/charts/ColumnChart";
import { TimeSeriesChart } from "@/components/admin/charts/TimeSeriesChart";
import { BarList } from "@/components/admin/charts/BarList";
import { formatStat, sumOf } from "@/components/admin/charts/format";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsagePage() {
  const [{ series, share }, { users }] = await Promise.all([getUsageData(), getAdminUsers()]);

  const dates = series.map((p) => p.date);
  const toolKeys = share.map((t) => t.tool);
  const runsOn = (p: UsagePoint) => toolKeys.reduce((s, k) => s + p[k], 0);
  const dailyRuns = series.map(runsOn);
  const totalRuns = sumOf(dailyRuns);
  const ranked = [...share].sort((a, b) => b.count - a.count);
  const topTool = ranked[0];
  const mcpDaily = series.map((p) => p.mcp);
  const avgPerDay = totalRuns / Math.max(series.length, 1);

  // Small multiples share one ceiling so a tall line means more runs, not
  // just a busier shape.
  const sharedMax = Math.max(0, ...toolKeys.flatMap((k) => series.map((p) => p[k])));

  const powerUsers = [...users]
    .map((u) => ({ ...u, totalUsage: u.usage.bends + u.usage.transcripts + u.usage.downloads + u.usage.apiCalls }))
    .filter((u) => u.totalUsage > 0)
    .sort((a, b) => b.totalUsage - a.totalUsage)
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Usage & tools" description="Which tools people run, how often, and who runs them most." />

      <KpiStrip>
        <Kpi label="Tool runs, 30 days" value={formatStat(totalRuns)} trend={dailyRuns.slice(-14)} />
        <Kpi
          label="Most used tool"
          value={topTool && topTool.count > 0 ? topTool.label : "None yet"}
          footnote={
            topTool && totalRuns > 0
              ? `${formatNumber(topTool.count)} runs · ${Math.round((topTool.count / totalRuns) * 100)}% of all`
              : undefined
          }
        />
        <Kpi label="Runs per day" value={formatStat(Math.round(avgPerDay))} footnote="30-day average" />
        <Kpi label="MCP calls, 30 days" value={formatStat(sumOf(mcpDaily))} trend={mcpDaily.slice(-14)} />
      </KpiStrip>

      <Panel title="Runs per day" description="Every tool combined, last 30 days">
        <ColumnChart dates={dates} values={dailyRuns} label="Tool runs" height={220} ariaLabel="Tool runs per day, last 30 days" />
      </Panel>

      <Panel title="By tool" description="Daily runs per tool on one shared scale, last 30 days">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ranked.map((tool) => (
            <div key={tool.tool} className="flex min-w-0 flex-col gap-3 rounded-lg border border-hairline p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[13px] font-medium text-heading">{tool.label}</p>
                <p className="shrink-0 text-[13px] tabular-nums">
                  <span className="font-semibold text-heading">{formatNumber(tool.count)}</span>
                  <span className="ml-1.5 text-subtle">
                    {totalRuns > 0 ? `${Math.round((tool.count / totalRuns) * 100)}%` : "0%"}
                  </span>
                </p>
              </div>
              <TimeSeriesChart
                dates={dates}
                series={[{ label: tool.label, values: series.map((p) => p[tool.tool]) }]}
                axes={false}
                height={56}
                yMax={sharedMax}
                ariaLabel={`${tool.label} runs per day, last 30 days`}
              />
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Total runs by tool" description="Last 30 days">
          <BarList items={ranked.map((t) => ({ label: t.label, value: t.count }))} emptyLabel="No tool runs yet" />
        </Panel>

        <Panel className="xl:col-span-2" title="Most active users" description="Ranked by total runs across every product" flush>
          {powerUsers.length === 0 ? (
            <p className="border-t border-hairline px-5 py-12 text-center text-[13px] text-subtle">No usage recorded yet.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell className="pl-5">User</TableHeaderCell>
                  <TableHeaderCell>Plan</TableHeaderCell>
                  <TableHeaderCell className="text-right">Bends</TableHeaderCell>
                  <TableHeaderCell className="text-right">Transcripts</TableHeaderCell>
                  <TableHeaderCell className="text-right">Downloads</TableHeaderCell>
                  <TableHeaderCell className="pr-5 text-right">API calls</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {powerUsers.map((u) => (
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
                    <TableCell className="text-right tabular-nums">{formatNumber(u.usage.bends)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(u.usage.transcripts)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(u.usage.downloads)}</TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">{formatNumber(u.usage.apiCalls)}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}
