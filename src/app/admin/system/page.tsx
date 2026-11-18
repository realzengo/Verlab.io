import { CircleCheck, CircleX, Clock3, LoaderCircle, TimerOff } from "lucide-react";
import { HardDrivesIcon, ShieldCheckIcon, StackIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import {
  computeJobSuccessRate,
  getApiErrorRate,
  getEndpointHealthToday,
  getSystemJobs,
  getUptimeStats,
} from "@/lib/server/admin-queries";
import type { SystemJob } from "@/lib/types";
import { PageHeader, LiveIndicator } from "@/components/admin/PageHeader";
import { MiniStat, Panel } from "@/components/admin/Panel";
import { Kpi, KpiStrip, rateTone } from "@/components/admin/KpiStrip";
import { formatStat } from "@/components/admin/charts/format";
import { SystemJobsTable } from "@/components/admin/SystemJobsTable";
import { JOB_TYPE_LABEL } from "@/components/admin/job-labels";
import { EndpointHealthTable } from "@/components/admin/EndpointHealthTable";
import { ShareBar } from "@/components/admin/charts/ShareBar";
import { BarList } from "@/components/admin/charts/BarList";
import { formatNumber } from "@/lib/utils";
import { endpointDetail, formatDuration, jobsDetail } from "@/components/admin/details";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const [jobs, uptime, apiErrorRate, endpointHealth] = await Promise.all([
    getSystemJobs(150),
    getUptimeStats(),
    getApiErrorRate(),
    getEndpointHealthToday(),
  ]);
  const successRate = computeJobSuccessRate(jobs);

  const count = (status: SystemJob["status"]) => jobs.filter((j) => j.status === status).length;
  const running = count("running");
  const queued = count("queued");
  const failed = count("failed");
  const stuck = count("stuck");
  const nowIso = new Date().toISOString();
  const succeeded = count("success");

  // Every list row opens what's behind its number (components/admin/details).
  const byType = new Map<SystemJob["type"], SystemJob[]>();
  for (const job of jobs) byType.set(job.type, [...(byType.get(job.type) ?? []), job]);
  const jobsByType = [...byType.entries()]
    .map(([type, list]) => ({
      label: JOB_TYPE_LABEL[type],
      value: list.length,
      detail: jobsDetail({ title: JOB_TYPE_LABEL[type], subtitle: `Last ${jobs.length} jobs`, jobs: list, allCount: jobs.length, nowIso }),
    }))
    .sort((a, b) => b.value - a.value);

  const slowest = [...endpointHealth]
    .sort((a, b) => b.p95Ms - a.p95Ms)
    .slice(0, 6)
    .map((row) => ({ label: row.endpoint, tag: row.method, value: row.p95Ms, detail: endpointDetail(row) }));

  // How long a finished job takes: the typical run and the slowest one.
  const finished = jobs
    .filter((j) => j.status === "success" && j.durationMs != null)
    .sort((a, b) => (a.durationMs ?? 0) - (b.durationMs ?? 0));
  const medianRun = finished.length ? finished[Math.floor(finished.length / 2)].durationMs ?? null : null;
  const longestRun = finished.at(-1) ?? null;

  const statusInfo = (status: SystemJob["status"], title: string) =>
    jobsDetail({
      title,
      subtitle: `Last ${jobs.length} jobs`,
      jobs: jobs.filter((j) => j.status === status),
      allCount: jobs.length,
      nowIso,
      byTool: true,
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="System" description="Job queue, endpoint latency and uptime.">
        <LiveIndicator />
      </PageHeader>

      <KpiStrip>
        <Kpi
          label="Uptime, 30 days"
          tone={rateTone(uptime.uptimePct, 99.9, 99)}
          icon={HardDrivesIcon}
          accent
          value={uptime.uptimePct !== null ? `${uptime.uptimePct}%` : "Collecting"}
          footnote={uptime.uptimePct !== null ? `${formatNumber(uptime.totalChecks)} checks` : "Checked every 5 minutes"}
        />
        <Kpi
          label="Job success rate"
          tone={rateTone(successRate, 90, 70)}
          icon={ShieldCheckIcon}
          value={`${successRate}%`}
          delta={{
            value: stuck > 0 ? `${failed} failed · ${stuck} stuck` : `${failed} failed`,
            sentiment: failed + stuck > 0 ? "negative" : "positive",
            label: `of last ${jobs.length}`,
          }}
        />
        <Kpi label="Jobs in flight" value={formatStat(running + queued)} footnote={`${running} running · ${queued} queued`} icon={StackIcon} />
        <Kpi
          label="API error rate, 24h"
          tone={rateTone(apiErrorRate.errorRatePct, 0, 2, false)}
          icon={WarningIcon}
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
        {/* The three panels share a row: the lists spread to its height and
            the status panel closes with how long runs take. */}
        <Panel title="Job status" description={`Last ${jobs.length} jobs`} bodyClassName="flex flex-col">
          <ShareBar
            emptyLabel="No jobs yet"
            segments={[
              { label: "Succeeded", info: statusInfo("success", "Succeeded jobs"), value: succeeded, color: "var(--viz-good)", icon: <CircleCheck className="h-4 w-4" /> },
              { label: "Failed", info: statusInfo("failed", "Failed jobs"), value: failed, color: "var(--viz-critical)", icon: <CircleX className="h-4 w-4" /> },
              { label: "Stuck", info: statusInfo("stuck", "Stuck jobs"), value: stuck, color: "var(--viz-serious)", icon: <TimerOff className="h-4 w-4" /> },
              { label: "Running", info: statusInfo("running", "Running jobs"), value: running, color: "var(--viz-1)", icon: <LoaderCircle className="h-4 w-4" /> },
              { label: "Queued", info: statusInfo("queued", "Queued jobs"), value: queued, color: "var(--viz-neutral)", icon: <Clock3 className="h-4 w-4" /> },
            ]}
          />
          <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
            <MiniStat label="Typical run" value={medianRun != null ? formatDuration(medianRun) : "—"} hint="Median, succeeded" />
            <MiniStat
              label="Longest run"
              value={longestRun?.durationMs != null ? formatDuration(longestRun.durationMs) : "—"}
              hint={longestRun ? JOB_TYPE_LABEL[longestRun.type] : "No runs yet"}
            />
          </div>
        </Panel>

        <Panel title="Jobs by type" description={`Last ${jobs.length} jobs`} bodyClassName="flex flex-col">
          <BarList items={jobsByType} emptyLabel="No jobs yet" fill />
        </Panel>

        <Panel title="Slowest endpoints" description="p95 response time, today" bodyClassName="flex flex-col">
          <BarList items={slowest} format="ms" showShare={false} emptyLabel="No requests logged today" fill />
        </Panel>
      </div>

      <EndpointHealthTable rows={endpointHealth} />

      <SystemJobsTable jobs={jobs} nowIso={nowIso} />
    </div>
  );
}
