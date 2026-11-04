"use client";

import { useMemo, useState } from "react";
import type { SystemJob, SystemJobStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Panel } from "@/components/admin/Panel";
import { SegmentedControl } from "@/components/admin/SegmentedControl";
import { JOB_STATUS_LABEL as STATUS_LABEL, JOB_TYPE_LABEL } from "@/components/admin/job-labels";

const STATUS_VARIANT: Record<SystemJobStatus, "success" | "danger" | "warning" | "default"> = {
  success: "success",
  failed: "danger",
  running: "warning",
  queued: "default",
};

const FILTER_ORDER: ("all" | SystemJobStatus)[] = ["all", "running", "queued", "failed", "success"];

export function SystemJobsTable({ jobs }: { jobs: SystemJob[] }) {
  const [filter, setFilter] = useState<string>("all");
  const filtered = useMemo(() => (filter === "all" ? jobs : jobs.filter((j) => j.status === filter)), [jobs, filter]);

  const filters = FILTER_ORDER.map((id) => ({
    id,
    label: id === "all" ? "All" : STATUS_LABEL[id],
    count: id === "all" ? jobs.length : jobs.filter((j) => j.status === id).length,
  }));

  return (
    <Panel
      title="Job queue"
      description="Niche Bend, SOP, transcript, download and generation jobs"
      action={<SegmentedControl label="Filter jobs by status" items={filters} active={filter} onChange={setFilter} />}
      flush
    >
      {filtered.length === 0 ? (
        <p className="border-t border-hairline px-5 py-12 text-center text-[13px] text-subtle">
          {jobs.length === 0 ? "Jobs will show up here as people run tools." : "No jobs with this status."}
        </p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell className="pl-5">Job</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>User</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Error</TableHeaderCell>
              <TableHeaderCell className="pr-5 text-right">Duration</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {filtered.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="pl-5 font-mono text-xs text-subtle">
                  <span title={job.id}>{job.id.slice(0, 8)}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-heading">{JOB_TYPE_LABEL[job.type]}</TableCell>
                <TableCell className="text-body">{job.userEmail}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[job.status]}>{STATUS_LABEL[job.status]}</Badge>
                </TableCell>
                <TableCell className="max-w-[280px] text-xs">
                  {job.status === "failed" && job.errorMessage ? (
                    <span className="block truncate text-danger" title={job.errorMessage}>
                      {job.errorMessage}
                    </span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </TableCell>
                <TableCell className="pr-5 text-right tabular-nums text-body">
                  {job.durationMs ? `${(job.durationMs / 1000).toFixed(1)}s` : <span className="text-subtle">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}
