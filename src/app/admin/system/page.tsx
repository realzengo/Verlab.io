import { AlertTriangle, CheckCircle2, Gauge, Loader2 } from "lucide-react";
import {
  computeJobSuccessRate,
  getApiErrorRate,
  getEndpointHealthToday,
  getSystemJobs,
  getUptimeStats,
} from "@/lib/server/admin-queries";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/admin/StatTile";
import { SystemJobsTable } from "@/components/admin/SystemJobsTable";
import { EndpointHealthTable } from "@/components/admin/EndpointHealthTable";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const [SYSTEM_JOBS, uptime, apiErrorRate, endpointHealth] = await Promise.all([
    getSystemJobs(50),
    getUptimeStats(),
    getApiErrorRate(),
    getEndpointHealthToday(),
  ]);
  const JOB_SUCCESS_RATE_PCT = computeJobSuccessRate(SYSTEM_JOBS);

  const running = SYSTEM_JOBS.filter((j) => j.status === "running").length;
  const queued = SYSTEM_JOBS.filter((j) => j.status === "queued").length;
  const failed = SYSTEM_JOBS.filter((j) => j.status === "failed").length;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Uptime (30d)"
          value={uptime.uptimePct !== null ? `${uptime.uptimePct}%` : "—"}
          icon={CheckCircle2}
          delta={
            uptime.uptimePct !== null
              ? { value: `${uptime.totalChecks} checks`, direction: "up", isGood: true, period: "last 30d" }
              : { value: "collecting", direction: "up", isGood: true, period: "checks every 5 min" }
          }
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
          value={apiErrorRate.errorRatePct !== null ? `${apiErrorRate.errorRatePct}%` : "—"}
          icon={AlertTriangle}
          delta={
            apiErrorRate.errorRatePct !== null
              ? {
                  value: `${apiErrorRate.totalRequests} requests`,
                  direction: apiErrorRate.errorRatePct > 0 ? "down" : "up",
                  isGood: apiErrorRate.errorRatePct === 0,
                  period: "last 24h",
                }
              : { value: "no traffic yet", direction: "up", isGood: true, period: "last 24h" }
          }
        />
      </div>

      <Card>
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-heading">API & MCP endpoint health</h3>
          <p className="text-xs text-body">Response times and error rates, today</p>
        </div>
        {endpointHealth.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No requests logged yet"
            description="Instrumentation is live — per-endpoint latency and error rates will appear here once traffic comes through the tracked routes."
          />
        ) : (
          <EndpointHealthTable rows={endpointHealth} />
        )}
      </Card>

      <Card>
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-heading">Job queue</h3>
          <p className="text-xs text-body">Niche Bend, SOP, transcript, and download jobs</p>
        </div>
        {SYSTEM_JOBS.length === 0 ? (
          <EmptyState icon={Gauge} title="No jobs yet" description="Jobs will show up here as users run tools." />
        ) : (
          <SystemJobsTable jobs={SYSTEM_JOBS} />
        )}
      </Card>
    </div>
  );
}
