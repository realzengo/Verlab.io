"use client";

import { useMemo, useState } from "react";
import type { FailedPayment, FailedPaymentEmailStatus, FailedPaymentKind } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Panel } from "@/components/admin/Panel";
import { SegmentedControl } from "@/components/admin/SegmentedControl";
import { Pagination, usePagination } from "@/components/admin/Pagination";
import { formatDate } from "@/lib/utils";

const formatMoney = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const KIND_LABEL: Record<FailedPaymentKind, string> = {
  renewal: "Renewal",
  new_signup: "New signup",
  credit_pack: "Credit pack",
  other: "Other",
};

const EMAIL_LABEL: Record<FailedPaymentEmailStatus, { label: string; variant: "success" | "danger" | "neutral" }> = {
  sent: { label: "Emailed", variant: "success" },
  failed: { label: "Email failed", variant: "danger" },
  sending: { label: "Sending", variant: "neutral" },
  not_sent: { label: "—", variant: "neutral" },
};

const isOpenRenewal = (p: FailedPayment) => p.kind === "renewal" && !p.recovered;

export function FailedPaymentsTable({ payments }: { payments: FailedPayment[] }) {
  const openRenewals = payments.filter(isOpenRenewal).length;
  const [filter, setFilter] = useState(openRenewals > 0 ? "open" : "all");

  const filtered = useMemo(() => {
    if (filter === "open") return payments.filter(isOpenRenewal);
    if (filter === "renewal") return payments.filter((p) => p.kind === "renewal");
    if (filter === "recovered") return payments.filter((p) => p.recovered);
    return payments;
  }, [payments, filter]);
  const { pageItems, pagerProps } = usePagination(filtered, 8, filter);

  const filters = [
    { id: "open", label: "Unresolved renewals", count: openRenewals },
    { id: "renewal", label: "All renewals", count: payments.filter((p) => p.kind === "renewal").length },
    { id: "recovered", label: "Recovered", count: payments.filter((p) => p.recovered).length },
    { id: "all", label: "All", count: payments.length },
  ];

  return (
    <Panel
      title="Failed payments"
      description="Declined Whop charges in the last 90 days. Renewal customers get one email per failed payment."
      action={<SegmentedControl label="Filter failed payments" items={filters} active={filter} onChange={setFilter} />}
      flush
    >
      {filtered.length === 0 ? (
        <p className="border-t border-hairline px-5 py-12 text-center text-[13px] text-subtle">
          {payments.length === 0
            ? "No failed charges in the last 90 days."
            : filter === "open"
              ? "No unresolved renewals. Every failed renewal has since been paid."
              : "Nothing matches this filter."}
        </p>
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="pl-5">Customer</TableHeaderCell>
                <TableHeaderCell>Charge</TableHeaderCell>
                <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                <TableHeaderCell>Reason</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell className="pr-5 text-right">Last attempt</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {pageItems.map((p) => (
                <TableRow key={p.paymentId}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p.userName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-heading">{p.userName}</p>
                        <p className="truncate text-xs text-subtle">{p.userEmail}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-body">{KIND_LABEL[p.kind]}</p>
                    {p.planLabel && <p className="text-xs text-subtle">{p.planLabel}</p>}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-heading">{formatMoney(p.amount)}</TableCell>
                  <TableCell className="max-w-[260px]">
                    <p className="truncate text-body" title={p.reason ?? undefined}>
                      {p.reason ?? <span className="text-subtle">—</span>}
                    </p>
                    <p className="text-xs tabular-nums text-subtle">
                      {p.attempts} attempt{p.attempts === 1 ? "" : "s"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.recovered ? "success" : p.kind === "renewal" ? "danger" : "warning"}>
                      {p.recovered ? "Recovered" : "Unpaid"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.emailStatus === "not_sent" ? (
                      <span className="text-subtle">—</span>
                    ) : (
                      <Badge variant={EMAIL_LABEL[p.emailStatus].variant}>{EMAIL_LABEL[p.emailStatus].label}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap pr-5 text-right text-body">{formatDate(p.failedAt)}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
          <Pagination {...pagerProps} noun="failed payments" />
        </>
      )}
    </Panel>
  );
}
