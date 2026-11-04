"use client";

import { useMemo, useState } from "react";
import type { RevenueTransaction } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Panel } from "@/components/admin/Panel";
import { SegmentedControl } from "@/components/admin/SegmentedControl";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export function RevenueTransactionsTable({ transactions }: { transactions: RevenueTransaction[] }) {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((t) => t.type === filter)),
    [transactions, filter]
  );

  const filters = [
    { id: "all", label: "All", count: transactions.length },
    { id: "order.paid", label: "Payments", count: transactions.filter((t) => t.type === "order.paid").length },
    { id: "order.refunded", label: "Refunds", count: transactions.filter((t) => t.type === "order.refunded").length },
  ];

  return (
    <Panel
      title="Recent transactions"
      description="Payments and refunds from Whop, newest first"
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
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell className="pl-5">Customer</TableHeaderCell>
              <TableHeaderCell>Item</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount</TableHeaderCell>
              <TableHeaderCell className="pr-5 text-right">Date</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {filtered.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={txn.userName} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-heading">{txn.userName}</p>
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
                  {formatCurrency(txn.amount)}
                </TableCell>
                <TableCell className="whitespace-nowrap pr-5 text-right text-body">{formatDate(txn.createdAt)}</TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}
