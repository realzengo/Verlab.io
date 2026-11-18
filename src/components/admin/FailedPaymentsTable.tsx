"use client";

import { useMemo, useState } from "react";
import type { FailedPayment, FailedPaymentEmailStatus, FailedPaymentKind } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { Panel } from "@/components/admin/Panel";
import { SegmentedControl } from "@/components/admin/SegmentedControl";
import { Pagination, usePagination } from "@/components/admin/Pagination";
import { formatDate } from "@/lib/utils";
import { DetailDialog } from "@/components/admin/DetailDialog";
import { ADMIN_BUTTON } from "@/components/admin/AdminDialog";
import type { DetailSpec } from "@/components/admin/details";

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

/** Local date and time, for the dialog (rendered on the client only). */
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const isOpenRenewal = (p: FailedPayment) => p.kind === "renewal" && !p.recovered;

function failedPaymentDetail(p: FailedPayment): DetailSpec {
  return {
    title: `${KIND_LABEL[p.kind]}${p.planLabel ? ` · ${p.planLabel}` : ""}`,
    subtitle: `${p.userName} · ${p.userEmail}`,
    rows: [
      { label: "Amount", value: formatMoney(p.amount) },
      { label: "Status", value: p.recovered ? "Recovered, paid later" : "Unpaid", tone: p.recovered ? "good" : "bad" },
      { label: "Attempts", value: String(p.attempts) },
      { label: "Customer email", value: EMAIL_LABEL[p.emailStatus].label === "—" ? "Not sent" : EMAIL_LABEL[p.emailStatus].label, tone: p.emailStatus === "failed" ? "bad" : p.emailStatus === "sent" ? "good" : "muted" },
      { label: "Last attempt", value: when(p.failedAt) },
      { label: "Payment ID", value: p.paymentId, mono: true },
    ],
    note: p.reason ? { label: "Decline reason", text: p.reason, tone: "bad" } : undefined,
  };
}

export function FailedPaymentsTable({ payments }: { payments: FailedPayment[] }) {
  const openRenewals = payments.filter(isOpenRenewal).length;
  const [filter, setFilter] = useState(openRenewals > 0 ? "open" : "all");
  const [selected, setSelected] = useState<FailedPayment | null>(null);

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
                <TableRow key={p.paymentId} onClick={() => setSelected(p)} className="cursor-pointer">
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={p.userName} size="sm" />
                      <div className="min-w-0">
                        <button type="button" className="block max-w-full truncate rounded font-medium text-heading outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
                          {p.userName}
                        </button>
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
      <DetailDialog
        spec={selected && failedPaymentDetail(selected)}
        onClose={() => setSelected(null)}
        media={selected ? <UserAvatar name={selected.userName} size="md" className="h-10 w-10" /> : undefined}
        actions={
          selected && (
            <a href={`mailto:${selected.userEmail}`} className={ADMIN_BUTTON.secondary}>
              Email customer
            </a>
          )
        }
      />
    </Panel>
  );
}
