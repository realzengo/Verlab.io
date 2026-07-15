import { AlertTriangle, CheckCircle2, Gauge, Loader2 } from "lucide-react";
import { API_HEALTH, JOB_SUCCESS_RATE_PCT, SYSTEM_JOBS, UPTIME_PCT_30D } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/admin/StatTile";
import { SystemJobsTable } from "@/components/admin/SystemJobsTable";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

export default function AdminSystemPage() {
  const running = SYSTEM_JOBS.filter((j) => j.status === "running").length;
  const queued = SYSTEM_JOBS.filter((j) => j.status === "queued").length;
  const failed = SYSTEM_JOBS.filter((j) => j.status === "failed").length;
  const avgErrorRate = API_HEALTH.reduce((s, e) => s + e.errorRatePct, 0) / API_HEALTH.length;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Uptime (30d)"
          value={`${UPTIME_PCT_30D}%`}
          icon={CheckCircle2}
          delta={{ value: "operational", direction: "up", isGood: true, period: "all services" }}
        />
        <StatTile
          label="Job success rate"
          value={`${JOB_SUCCESS_RATE_PCT}%`}
          icon={Gauge}
          delta={{ value: `${failed} failed`, direction: failed > 0 ? "down" : "up", isGood: failed === 0, period: "recent jobs" }}
        />
        <StatTile
          label="Jobs in flight"
          value={`${running + queued}`}
          icon={Loader2}
          delta={{ value: `${running} running`, direction: "up", isGood: true, period: `${queued} queued` }}
        />
        <StatTile
          label="Avg. API error rate"
          value={`${avgErrorRate.toFixed(2)}%`}
          icon={AlertTriangle}
          delta={{ value: avgErrorRate < 2 ? "healthy" : "elevated", direction: avgErrorRate < 2 ? "down" : "up", isGood: avgErrorRate < 2, period: "across endpoints" }}
        />
      </div>

      <Card>
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-heading">API & MCP endpoint health</h3>
          <p className="text-xs text-body">Response times and error rates, today</p>
        </div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Endpoint</TableHeaderCell>
              <TableHeaderCell>Method</TableHeaderCell>
              <TableHeaderCell className="text-right">Calls today</TableHeaderCell>
              <TableHeaderCell className="text-right">p50</TableHeaderCell>
              <TableHeaderCell className="text-right">p95</TableHeaderCell>
              <TableHeaderCell className="text-right">Error rate</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {API_HEALTH.map((e) => (
              <TableRow key={e.endpoint}>
                <TableCell className="font-mono text-xs text-heading">{e.endpoint}</TableCell>
                <TableCell className="text-body">{e.method}</TableCell>
                <TableCell className="text-right tabular-nums">{e.callsToday.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums text-body">{e.p50Ms}ms</TableCell>
                <TableCell className="text-right tabular-nums text-body">{e.p95Ms}ms</TableCell>
                <TableCell className="text-right">
                  <Badge variant={e.errorRatePct >= 2 ? "danger" : e.errorRatePct >= 1 ? "warning" : "success"}>
                    {e.errorRatePct}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-heading">Job queue</h3>
          <p className="text-xs text-body">Niche Bend, SOP, transcript, and download jobs</p>
        </div>
        <SystemJobsTable jobs={SYSTEM_JOBS} />
      </Card>
    </div>
  );
}
