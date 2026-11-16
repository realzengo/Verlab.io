"use client";

import { useMemo, useState } from "react";
import type { SystemJob, SystemJobStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Panel } from "@/components/admin/Panel";
import { SegmentedControl } from "@/components/admin/SegmentedControl";
import { Pagination, usePagination } from "@/components/admin/Pagination";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { JOB_STATUS_LABEL as STATUS_LABEL, JOB_TYPE_LABEL } from "@/components/admin/job-labels";

const STATUS_VARIANT: Record<SystemJobStatus, "success" | "danger" | "warning" | "default"> = {
  success: "success",
  failed: "danger",
  stuck: "danger",
  running: "warning",
  queued: "default",
};

// "Problems" first: failed plus stuck is everything a user hit a wall on.
const FILTER_ORDER: ("all" | "problems" | SystemJobStatus)[] = ["all", "problems", "failed", "stuck", "running", "queued", "success"];

const isProblem = (job: SystemJob) => job.status === "failed" || job.status === "stuck";

function matchesStatus(job: SystemJob, filter: string) {
  if (filter === "all") return true;
  if (filter === "problems") return isProblem(job);
  return job.status === filter;
}

function timeAgo(iso: string, nowIso: string): string {
  const minutes = Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function SystemJobsTable({ jobs, nowIso }: { jobs: SystemJob[]; nowIso: string }) {
  const [filter, setFilter] = useState<string>("all");
  const [tool, setTool] = useState<"all" | SystemJob["type"]>("all");

  const byTool = useMemo(() => (tool === "all" ? jobs : jobs.filter((j) => j.type === tool)), [jobs, tool]);
  const filtered = useMemo(() => byTool.filter((j) => matchesStatus(j, filter)), [byTool, filter]);
  const { pageItems, pagerProps } = usePagination(filtered, 10, `${filter}|${tool}`);

  const filters = FILTER_ORDER.map((id) => ({
    id,
    label: id === "all" ? "All" : id === "problems" ? "Problems" : STATUS_LABEL[id],
    count: byTool.filter((j) => matchesStatus(j, id)).length,
  }));

  // Only tools that actually have jobs in the window, with their problem count.
  const toolOptions = [
    { value: "all" as const, label: "All" },
    ...(Object.keys(JOB_TYPE_LABEL) as SystemJob["type"][])
      .filter((t) => jobs.some((j) => j.type === t))
      .map((t) => {
        const problems = jobs.filter((j) => j.type === t && isProblem(j)).length;
        return { value: t, label: problems > 0 ? `${JOB_TYPE_LABEL[t]} · ${problems} ${problems === 1 ? "problem" : "problems"}` : JOB_TYPE_LABEL[t] };
      }),
  ];

  return (
    <Panel
      title="Job queue"
      description="Every tool run: Niche Bend, transcripts, downloads, clipping, creator analysis, niche reports and generations. Stuck = no result after an hour."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <AdminSelect size="sm" align="right" label="Filter jobs by tool" prefix="Tool" value={tool} onChange={setTool} options={toolOptions} />
          <SegmentedControl label="Filter jobs by status" items={filters} active={filter} onChange={setFilter} />
        </div>
      }
      flush
    >
      {filtered.length === 0 ? (
        <p className="border-t border-hairline px-5 py-12 text-center text-[13px] text-subtle">
          {jobs.length === 0 ? "Jobs will show up here as people run tools." : "No jobs match these filters."}
        </p>
      ) : (
        <>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell className="pl-5">Job</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>User</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Error</TableHeaderCell>
              <TableHeaderCell>Started</TableHeaderCell>
              <TableHeaderCell className="pr-5 text-right">Duration</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {pageItems.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="pl-5 font-mono text-xs text-subtle">
                  <span title={job.id}>{job.id.slice(0, 8)}</span>
                </TableCell>
                <TableCell className="max-w-[240px]">
                  <p className="whitespace-nowrap text-heading">{JOB_TYPE_LABEL[job.type]}</p>
                  {job.source &&
                    (/^https?:\/\//.test(job.source) ? (
                      <a
                        href={job.source}
                        target="_blank"
                        rel="noreferrer"
                        title={job.source}
                        className="block truncate text-xs text-subtle hover:text-heading hover:underline"
                      >
                        {job.source.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    ) : (
                      <p className="truncate text-xs text-subtle" title={job.source}>
                        {job.source}
                      </p>
                    ))}
                </TableCell>
                <TableCell className="text-body">{job.userEmail}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[job.status]}>{STATUS_LABEL[job.status]}</Badge>
                </TableCell>
                <TableCell className="max-w-[320px] text-xs">
                  {job.status === "failed" ? (
                    <span className="line-clamp-2 break-words text-danger" title={job.errorMessage ?? undefined}>
                      {job.errorMessage || "Failed without an error message"}
                    </span>
                  ) : job.status === "stuck" ? (
                    <span className="text-danger">No result after {timeAgo(job.startedAt, nowIso).replace(" ago", "")}, never finished</span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-body">
                  <span title={`${job.startedAt.slice(0, 16).replace("T", " ")} UTC`}>{timeAgo(job.startedAt, nowIso)}</span>
                </TableCell>
                <TableCell className="pr-5 text-right tabular-nums text-body">
                  {job.durationMs ? `${(job.durationMs / 1000).toFixed(1)}s` : <span className="text-subtle">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
        <Pagination {...pagerProps} noun="jobs" />
        </>
      )}
    </Panel>
  );
}
