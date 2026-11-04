"use client";

import type { ApiEndpointHealth } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Panel } from "@/components/admin/Panel";
import { cn } from "@/lib/utils";

function statusBadge(errorRatePct: number): { variant: "success" | "warning" | "danger"; label: string } {
  if (errorRatePct >= 10) return { variant: "danger", label: "Degraded" };
  if (errorRatePct > 0) return { variant: "warning", label: "Watch" };
  return { variant: "success", label: "Healthy" };
}

export function EndpointHealthTable({ rows }: { rows: ApiEndpointHealth[] }) {
  // A quiet in-cell bar puts each p95 against the slowest one today, so the
  // outliers read before the numbers do.
  const maxP95 = Math.max(1, ...rows.map((r) => r.p95Ms));

  return (
    <Panel title="API & MCP endpoints" description="Calls, latency and error rate per endpoint, today" flush>
      {rows.length === 0 ? (
        <p className="border-t border-hairline px-5 py-12 text-center text-[13px] text-subtle">
          Instrumentation is live. Per-endpoint latency and error rates appear once traffic reaches the tracked routes.
        </p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell className="pl-5">Endpoint</TableHeaderCell>
              <TableHeaderCell>Method</TableHeaderCell>
              <TableHeaderCell className="text-right">Calls</TableHeaderCell>
              <TableHeaderCell className="text-right">p50</TableHeaderCell>
              <TableHeaderCell className="w-[180px]">p95</TableHeaderCell>
              <TableHeaderCell className="text-right">Errors</TableHeaderCell>
              <TableHeaderCell className="pr-5">Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {rows.map((row) => {
              const status = statusBadge(row.errorRatePct);
              return (
                <TableRow key={`${row.endpoint}::${row.method}`}>
                  <TableCell className="whitespace-nowrap pl-5 font-mono text-xs text-heading">{row.endpoint}</TableCell>
                  <TableCell>
                    <span className="rounded bg-(--admin-fill-strong) px-1.5 py-0.5 font-mono text-[11px] font-medium text-body">
                      {row.method}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-body">{row.callsToday.toLocaleString("en-US")}</TableCell>
                  <TableCell className="text-right tabular-nums text-body">{row.p50Ms}ms</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-(--admin-fill)">
                        <div
                          className="h-full rounded-full bg-(--viz-1)"
                          style={{ width: `${(row.p95Ms / maxP95) * 100}%` }}
                        />
                      </div>
                      <span className="w-14 shrink-0 text-right tabular-nums text-body">{row.p95Ms}ms</span>
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn("text-right tabular-nums", row.errorRatePct > 0 ? "font-medium text-danger" : "text-body")}
                  >
                    {row.errorRatePct}%
                  </TableCell>
                  <TableCell className="pr-5">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}
