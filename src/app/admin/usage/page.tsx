import { CalendarDotsIcon, LightningIcon, PlugIcon, TrophyIcon } from "@phosphor-icons/react/dist/ssr";
import { getAdminUsers, getUsageData } from "@/lib/server/admin-queries";
import type { UsagePoint } from "@/lib/types";
import { PageHeader } from "@/components/admin/PageHeader";
import { HeaderStats, Panel } from "@/components/admin/Panel";
import { Kpi, KpiStrip } from "@/components/admin/KpiStrip";
import { ColumnChart } from "@/components/admin/charts/ColumnChart";
import { BarList } from "@/components/admin/charts/BarList";
import { formatDay, formatStat, sumOf } from "@/components/admin/charts/format";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { formatNumber } from "@/lib/utils";
import { seriesDetail } from "@/components/admin/details";

export const dynamic = "force-dynamic";

/** "Last run today", "yesterday", "4 days ago": how fresh a tool's latest run is. */
function lastRunLabel(daysAgo: number): string {
  if (daysAgo <= 0) return "Last run today";
  if (daysAgo === 1) return "Last run yesterday";
  return `Last run ${daysAgo} days ago`;
}

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

  // Small multiples share one ceiling so a tall column means more runs, not
  // just a busier tile.
  const sharedMax = Math.max(0, ...toolKeys.flatMap((k) => series.map((p) => p[k])));
  const peakDay = totalRuns > 0 ? dailyRuns.indexOf(Math.max(...dailyRuns)) : -1;
  const activeDays = dailyRuns.filter((v) => v > 0).length;

  const powerUsers = [...users]
    .map((u) => ({ ...u, totalUsage: u.usage.bends + u.usage.transcripts + u.usage.downloads + u.usage.apiCalls }))
    .filter((u) => u.totalUsage > 0)
    .sort((a, b) => b.totalUsage - a.totalUsage)
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Usage & tools" description="Which tools people run, how often, and who runs them most." />

      <KpiStrip>
        <Kpi label="Tool runs, 30 days" value={formatStat(totalRuns)} icon={LightningIcon} accent />
        <Kpi
          label="Most used tool"
          icon={TrophyIcon}
          value={topTool && topTool.count > 0 ? topTool.label : "None yet"}
          footnote={
            topTool && totalRuns > 0
              ? `${formatNumber(topTool.count)} runs · ${Math.round((topTool.count / totalRuns) * 100)}% of all`
              : undefined
          }
        />
        <Kpi label="Runs per day" value={formatStat(Math.round(avgPerDay))} footnote="30-day average" icon={CalendarDotsIcon} />
        <Kpi label="MCP calls, 30 days" value={formatStat(sumOf(mcpDaily))} icon={PlugIcon} />
      </KpiStrip>

      <Panel
        title="Runs per day"
        description="Every tool combined, last 30 days"
        action={
          <HeaderStats
            items={[
              { label: "Today", value: formatNumber(dailyRuns[dailyRuns.length - 1] ?? 0) },
              peakDay >= 0
                ? { label: "Busiest day", value: formatNumber(dailyRuns[peakDay]), hint: formatDay(dates[peakDay]) }
                : { label: "Busiest day", value: "None" },
              { label: "Active days", value: formatNumber(activeDays), hint: `of ${dates.length}` },
            ]}
          />
        }
      >
        <ColumnChart dates={dates} values={dailyRuns} label="Tool runs" height={220} ariaLabel="Tool runs per day, last 30 days" />
      </Panel>

      <Panel title="By tool" description="Daily runs per tool on one shared scale, last 30 days">
        {/* A ruled grid, not cards in a card: one frame, hairlines between
            the tiles, every tile on the same scale. */}
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-hairline bg-(--color-hairline) sm:grid-cols-2 xl:grid-cols-4">
          {ranked.map((tool, rank) => {
            const values = series.map((p) => p[tool.tool]);
            const idle = tool.count === 0;
            const peak = idle ? -1 : values.indexOf(Math.max(...values));
            const lastRun = values.findLastIndex((v) => v > 0);
            return (
              <div key={tool.tool} className="flex min-w-0 flex-col bg-surface px-4 pb-4 pt-3.5 sm:px-5 sm:pb-4 sm:pt-4">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] tabular-nums text-subtle">{String(rank + 1).padStart(2, "0")}</span>
                  <p className={idle ? "truncate text-[13px] text-subtle" : "truncate text-[13px] font-medium text-heading"}>
                    {tool.label}
                  </p>
                  <span className="ml-auto shrink-0 text-[12px] tabular-nums text-subtle">
                    {totalRuns > 0 ? `${Math.round((tool.count / totalRuns) * 100)}%` : "0%"}
                  </span>
                </div>

                <p className="mt-2.5 flex items-baseline gap-1.5">
                  <span
                    className={
                      idle
                        ? "text-[24px] font-semibold leading-none tracking-[-0.03em] text-subtle"
                        : "text-[24px] font-semibold leading-none tracking-[-0.03em] text-heading"
                    }
                  >
                    {formatNumber(tool.count)}
                  </span>
                  <span className="text-[12px] text-subtle">{tool.count === 1 ? "run" : "runs"}</span>
                </p>

                <div className="mt-4">
                  <ColumnChart
                    dates={dates}
                    values={values}
                    label={tool.label}
                    axes={false}
                    height={44}
                    yMax={sharedMax}
                    ariaLabel={`${tool.label} runs per day, last 30 days`}
                  />
                </div>

                <div className="mt-3.5 flex items-center justify-between gap-3 text-[12px] text-subtle">
                  {idle ? (
                    <span>No runs in {dates.length} days</span>
                  ) : (
                    <>
                      <span className="truncate">
                        Peak <span className="font-medium tabular-nums text-body">{formatNumber(values[peak])}</span> ·{" "}
                        {formatDay(dates[peak])}
                      </span>
                      <span className="shrink-0">{lastRunLabel(values.length - 1 - lastRun)}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Total runs by tool" description="Last 30 days" bodyClassName="flex flex-col">
          <BarList
            items={ranked.map((t) => ({
              label: t.label,
              value: t.count,
              detail: seriesDetail({ title: t.label, dates, values: series.map((p) => p[t.tool]), total: totalRuns, unit: "runs" }),
            }))}
            emptyLabel="No tool runs yet"
            fill
          />
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
                        <UserAvatar name={u.name} size="sm" />
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
