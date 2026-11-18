"use client";

import { useMemo, useState } from "react";
import type { RevenueTransaction } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { Panel } from "@/components/admin/Panel";
import { SegmentedControl } from "@/components/admin/SegmentedControl";
import { Pagination, usePagination } from "@/components/admin/Pagination";
import { cn, formatDate } from "@/lib/utils";
import { DetailDialog } from "@/components/admin/DetailDialog";
import { ADMIN_BUTTON } from "@/components/admin/AdminDialog";
import type { DetailSpec } from "@/components/admin/details";

const formatMoney = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Local date and time, for the dialog (rendered on the client only). */
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function transactionDetail(txn: RevenueTransaction): DetailSpec {
  const refund = txn.type === "order.refunded";
  const fee = txn.net === undefined ? undefined : Math.abs(txn.amount) - Math.abs(txn.net);
  return {
    title: txn.itemLabel,
    subtitle: `${txn.userName} · ${txn.userEmail}`,
    rows: [
      { label: refund ? "Refunded" : "Paid", value: formatMoney(txn.amount), tone: refund ? "bad" : "default" },
      { label: "Whop fees", value: fee === undefined ? "—" : formatMoney(fee), tone: fee === undefined ? "muted" : "default" },
      { label: "After fees", value: txn.net === undefined ? "—" : formatMoney(txn.net), tone: txn.net === undefined ? "muted" : "good" },
      { label: "Billing reason", value: txn.billingReason ?? (refund ? "Refund" : "Payment") },
      { label: "Currency", value: txn.currency.toUpperCase() },
      { label: "Date", value: when(txn.createdAt) },
      { label: "Transaction ID", value: txn.id, mono: true },
    ],
  };
}

export function RevenueTransactionsTable({ transactions }: { transactions: RevenueTransaction[] }) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<RevenueTransaction | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((t) => t.type === filter)),
    [transactions, filter]
  );
  const { pageItems, pagerProps } = usePagination(filtered, 10, filter);

  const filters = [
    { id: "all", label: "All", count: transactions.length },
    { id: "order.paid", label: "Payments", count: transactions.filter((t) => t.type === "order.paid").length },
    { id: "order.refunded", label: "Refunds", count: transactions.filter((t) => t.type === "order.refunded").length },
  ];

  return (
    <Panel
      title="Recent transactions"
      description="Every payment and refund on Whop, newest first"
      action={<SegmentedControl label="Filter transactions" items={filters} active={filter} onChange={setFilter} />}
      flush
    >
      {filtered.length === 0 ? (
        <p className="border-t border-hairline px-5 py-12 text-center text-[13px] text-subtle">
          {transactions.length === 0
            ? "Payments and refunds will show up here the moment the first one comes in."
            : "Nothing matches this filter."}
        </p>
      ) : (
        <>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell className="pl-5">Customer</TableHeaderCell>
              <TableHeaderCell>Item</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell className="text-right">Paid</TableHeaderCell>
              <TableHeaderCell className="text-right">After fees</TableHeaderCell>
              <TableHeaderCell className="pr-5 text-right">Date</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {pageItems.map((txn) => (
              <TableRow key={txn.id} onClick={() => setSelected(txn)} className="cursor-pointer">
                <TableCell className="pl-5">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={txn.userName} size="sm" />
                    <div className="min-w-0">
                      <button type="button" className="block max-w-full truncate rounded font-medium text-heading outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
                        {txn.userName}
                      </button>
                      <p className="truncate text-xs text-subtle">{txn.userEmail}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-body">{txn.itemLabel}</TableCell>
                <TableCell>
                  <Badge variant={txn.type === "order.refunded" ? "warning" : "success"}>
                    {txn.billingReason ?? (txn.type === "order.refunded" ? "Refund" : "Payment")}
                  </Badge>
                </TableCell>
                <TableCell
                  className={cn("text-right font-medium tabular-nums", txn.amount < 0 ? "text-danger" : "text-heading")}
                >
                  {formatMoney(txn.amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-body">
                  {txn.net === undefined ? <span className="text-subtle">—</span> : formatMoney(txn.net)}
                </TableCell>
                <TableCell className="whitespace-nowrap pr-5 text-right text-body">{formatDate(txn.createdAt)}</TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
        <Pagination {...pagerProps} noun="transactions" />
        </>
      )}
      <DetailDialog
        spec={selected && transactionDetail(selected)}
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
