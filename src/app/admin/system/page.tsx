import { CircleCheck, CircleX, Clock3, LoaderCircle } from "lucide-react";
import {
  computeJobSuccessRate,
  getApiErrorRate,
  getEndpointHealthToday,
  getSystemJobs,
  getUptimeStats,
} from "@/lib/server/admin-queries";
import type { SystemJob } from "@/lib/types";
import { PageHeader, LiveIndicator } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { Kpi, KpiStrip } from "@/components/admin/KpiStrip";
import { formatStat } from "@/components/admin/charts/format";
import { SystemJobsTable } from "@/components/admin/SystemJobsTable";
import { JOB_TYPE_LABEL } from "@/components/admin/job-labels";
import { EndpointHealthTable } from "@/components/admin/EndpointHealthTable";
import { ShareBar } from "@/components/admin/charts/ShareBar";
import { BarList } from "@/components/admin/charts/BarList";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const [jobs, uptime, apiErrorRate, endpointHealth] = await Promise.all([
    getSystemJobs(50),
    getUptimeStats(),
    getApiErrorRate(),
    getEndpointHealthToday(),
  ]);
  const successRate = computeJobSuccessRate(jobs);

  const count = (status: SystemJob["status"]) => jobs.filter((j) => j.status === status).length;
  const running = count("running");
  const queued = count("queued");
  const failed = count("failed");
  const succeeded = count("success");

  const byType = new Map<SystemJob["type"], number>();
  for (const job of jobs) byType.set(job.type, (byType.get(job.type) ?? 0) + 1);
  const jobsByType = [...byType.entries()]
    .map(([type, n]) => ({ label: JOB_TYPE_LABEL[type], value: n }))
    .sort((a, b) => b.value - a.value);

  const slowest = [...endpointHealth]
    .sort((a, b) => b.p95Ms - a.p95Ms)
    .slice(0, 6)
    .map((row) => ({ label: row.endpoint, value: row.p95Ms }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="System" description="Job queue, endpoint latency and uptime.">
        <LiveIndicator />
      </PageHeader>

      <KpiStrip>
        <Kpi
          label="Uptime, 30 days"
          value={uptime.uptimePct !== null ? `${uptime.uptimePct}%` : "Collecting"}
          footnote={uptime.uptimePct !== null ? `${formatNumber(uptime.totalChecks)} checks` : "Checked every 5 minutes"}
        />
        <Kpi
          label="Job success rate"
          value={`${successRate}%`}
          delta={{ value: `${failed} failed`, sentiment: failed > 0 ? "negative" : "positive", label: `of last ${jobs.length}` }}
        />
        <Kpi label="Jobs in flight" value={formatStat(running + queued)} footnote={`${running} running · ${queued} queued`} />
        <Kpi
          label="API error rate, 24h"
          value={apiErrorRate.errorRatePct !== null ? `${apiErrorRate.errorRatePct}%` : "No traffic"}
          delta={
            apiErrorRate.errorRatePct !== null
              ? {
                  value: `${formatNumber(apiErrorRate.totalRequests)} requests`,
                  sentiment: apiErrorRate.errorRatePct > 0 ? "negative" : "positive",
                }
              : undefined
          }
        />
      </KpiStrip>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Job status" description={`Last ${jobs.length} jobs`}>
          <ShareBar
            emptyLabel="No jobs yet"
            segments={[
              { label: "Succeeded", value: succeeded, color: "var(--viz-good)", icon: <CircleCheck className="h-4 w-4" /> },
              { label: "Failed", value: failed, color: "var(--viz-critical)", icon: <CircleX className="h-4 w-4" /> },
              { label: "Running", value: running, color: "var(--viz-1)", icon: <LoaderCircle className="h-4 w-4" /> },
              { label: "Queued", value: queued, color: "var(--viz-neutral)", icon: <Clock3 className="h-4 w-4" /> },
            ]}
          />
        </Panel>

        <Panel title="Jobs by type" description={`Last ${jobs.length} jobs`}>
          <BarList items={jobsByType} emptyLabel="No jobs yet" />
        </Panel>

        <Panel title="Slowest endpoints" description="p95 response time, today">
          <BarList items={slowest} format="ms" showShare={false} emptyLabel="No requests logged today" />
        </Panel>
      </div>

      <EndpointHealthTable rows={endpointHealth} />

      <SystemJobsTable jobs={jobs} />
    </div>
  );
}
