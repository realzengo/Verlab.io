import { Activity, Flame, Plug, Wand2 } from "lucide-react";
import { ADMIN_USERS, TOOL_USAGE_SHARE, USAGE_SERIES } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/admin/StatTile";
import { LineAreaChart } from "@/components/charts/LineAreaChart";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { formatNumber } from "@/lib/utils";

export default function AdminUsagePage() {
  const labels = USAGE_SERIES.map((p) => p.date);
  const totalRuns = TOOL_USAGE_SHARE.reduce((s, t) => s + t.count, 0);
  const topTool = [...TOOL_USAGE_SHARE].sort((a, b) => b.count - a.count)[0];
  const mcpTotal = TOOL_USAGE_SHARE.find((t) => t.tool === "mcp")?.count ?? 0;
  const avgPerDay = totalRuns / USAGE_SERIES.length;

  const powerUsers = [...ADMIN_USERS]
    .map((u) => ({ ...u, totalUsage: u.usage.bends + u.usage.transcripts + u.usage.downloads + u.usage.apiCalls }))
    .sort((a, b) => b.totalUsage - a.totalUsage)
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tool runs (30d)" value={formatNumber(totalRuns)} icon={Activity} trend={USAGE_SERIES.map((p) => p.bend + p.niches + p.transcripts + p.downloader + p.mcp)} />
        <StatTile label="Most used tool" value={topTool.label} icon={Flame} />
        <StatTile label="Avg. runs / day" value={formatNumber(Math.round(avgPerDay))} icon={Wand2} />
        <StatTile label="MCP calls (30d)" value={formatNumber(mcpTotal)} icon={Plug} trend={USAGE_SERIES.map((p) => p.mcp)} />
      </div>

      <Card>
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-heading">Usage by tool over time</h3>
          <p className="text-xs text-body">Daily runs per tool, last 30 days — click a legend item to isolate it</p>
        </div>
        <LineAreaChart
          labels={labels}
          series={[
            { key: "bend", label: "Niche Bending", tone: "violet", data: USAGE_SERIES.map((p) => p.bend) },
            { key: "niches", label: "Niche Finder", tone: "blue", data: USAGE_SERIES.map((p) => p.niches) },
            { key: "transcripts", label: "Transcripts", tone: "amber", data: USAGE_SERIES.map((p) => p.transcripts) },
            { key: "downloader", label: "Downloader", tone: "green", data: USAGE_SERIES.map((p) => p.downloader) },
            { key: "mcp", label: "MCP", tone: "rose", data: USAGE_SERIES.map((p) => p.mcp) },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <h3 className="text-sm font-semibold text-heading">Total runs by tool</h3>
          <p className="mb-5 text-xs text-body">Last 30 days</p>
          <RankedBarList items={[...TOOL_USAGE_SHARE].sort((a, b) => b.count - a.count).map((t) => ({ label: t.label, value: t.count, tone: t.tone }))} />
        </Card>

        <Card className="xl:col-span-2">
          <h3 className="text-sm font-semibold text-heading">Most active users</h3>
          <p className="mb-4 text-xs text-body">Ranked by total tool usage across all products</p>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Plan</TableHeaderCell>
                <TableHeaderCell className="text-right">Bends</TableHeaderCell>
                <TableHeaderCell className="text-right">Transcripts</TableHeaderCell>
                <TableHeaderCell className="text-right">API calls</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {powerUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} size="sm" />
                      <span className="truncate font-medium text-heading">{u.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-body">{u.plan}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.usage.bends}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.usage.transcripts}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.usage.apiCalls}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
