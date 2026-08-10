"use client";

import { useMemo, useState } from "react";
import type { SystemJob, SystemJobStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

const STATUS_VARIANT: Record<SystemJobStatus, "success" | "danger" | "warning" | "default"> = {
  success: "success",
  failed: "danger",
  running: "warning",
  queued: "default",
};

const TYPE_LABEL: Record<SystemJob["type"], string> = {
  "niche-bend": "Niche Bend",
  "sop-generation": "SOP Generation",
  transcript: "Transcript",
  download: "Download",
  "video-generation": "Video Generation",
  "image-generation": "Image Generation",
  "voiceover-generation": "Voiceover Generation",
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "queued", label: "Queued" },
  { id: "failed", label: "Failed" },
  { id: "success", label: "Success" },
];

export function SystemJobsTable({ jobs }: { jobs: SystemJob[] }) {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => (filter === "all" ? jobs : jobs.filter((j) => j.status === filter)), [jobs, filter]);

  return (
    <div className="flex flex-col gap-4">
      <Tabs items={FILTERS} active={filter} onChange={setFilter} />
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Job</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>User</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Error</TableHeaderCell>
            <TableHeaderCell className="text-right">Duration</TableHeaderCell>
          </TableRow>
        </TableHead>
        <tbody>
          {filtered.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-mono text-xs text-body">{job.id}</TableCell>
              <TableCell className="text-heading">{TYPE_LABEL[job.type]}</TableCell>
              <TableCell className="text-body">{job.userEmail}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[job.status]}>{job.status}</Badge>
              </TableCell>
              <TableCell className="max-w-[280px] text-xs text-body">
                <span className="block truncate" title={job.errorMessage ?? undefined}>
                  {job.status === "failed" ? job.errorMessage || "—" : "—"}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums text-body">
                {job.durationMs ? `${(job.durationMs / 1000).toFixed(1)}s` : "—"}
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
