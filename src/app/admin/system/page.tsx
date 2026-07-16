import { AlertTriangle, CheckCircle2, Gauge, Loader2 } from "lucide-react";
import { computeJobSuccessRate, getSystemJobs } from "@/lib/server/admin-queries";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/admin/StatTile";
import { SystemJobsTable } from "@/components/admin/SystemJobsTable";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const SYSTEM_JOBS = await getSystemJobs(50);
  const JOB_SUCCESS_RATE_PCT = computeJobSuccessRate(SYSTEM_JOBS);

  const running = SYSTEM_JOBS.filter((j) => j.status === "running").length;
  const queued = SYSTEM_JOBS.filter((j) => j.status === "queued").length;
  const failed = SYSTEM_JOBS.filter((j) => j.status === "failed").length;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Uptime (30d)"
          value="—"
          icon={CheckCircle2}
          delta={{ value: "not tracked", direction: "up", isGood: true, period: "needs APM" }}
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
          value="—"
          icon={AlertTriangle}
          delta={{ value: "not tracked", direction: "up", isGood: true, period: "needs APM" }}
        />
      </div>

      <Card>
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-heading">API & MCP endpoint health</h3>
          <p className="text-xs text-body">Response times and error rates, today</p>
        </div>
        <EmptyState
          icon={AlertTriangle}
          title="Not wired up yet"
          description="Per-endpoint latency and error-rate tracking needs request-level instrumentation (APM), which isn't built in this pass."
        />
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
