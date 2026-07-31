"use client";

import type { ApiEndpointHealth } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

function statusBadge(errorRatePct: number): { variant: "success" | "warning" | "danger"; label: string } {
  if (errorRatePct >= 10) return { variant: "danger", label: "Degraded" };
  if (errorRatePct > 0) return { variant: "warning", label: "Watch" };
  return { variant: "success", label: "Healthy" };
}

export function EndpointHealthTable({ rows }: { rows: ApiEndpointHealth[] }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Endpoint</TableHeaderCell>
          <TableHeaderCell>Method</TableHeaderCell>
          <TableHeaderCell className="text-right">Calls today</TableHeaderCell>
          <TableHeaderCell className="text-right">p50</TableHeaderCell>
          <TableHeaderCell className="text-right">p95</TableHeaderCell>
          <TableHeaderCell className="text-right">Error rate</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
        </TableRow>
      </TableHead>
      <tbody>
        {rows.map((row) => {
          const status = statusBadge(row.errorRatePct);
          return (
            <TableRow key={`${row.endpoint}::${row.method}`}>
              <TableCell className="font-mono text-xs text-heading">{row.endpoint}</TableCell>
              <TableCell className="text-body">{row.method}</TableCell>
              <TableCell className="text-right tabular-nums text-body">{row.callsToday}</TableCell>
              <TableCell className="text-right tabular-nums text-body">{row.p50Ms}ms</TableCell>
              <TableCell className="text-right tabular-nums text-body">{row.p95Ms}ms</TableCell>
              <TableCell className="text-right tabular-nums text-body">{row.errorRatePct}%</TableCell>
              <TableCell>
                <Badge variant={status.variant}>{status.label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </tbody>
    </Table>
  );
}
