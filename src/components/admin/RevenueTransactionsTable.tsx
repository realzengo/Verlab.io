"use client";

import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import type { RevenueTransaction } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "order.paid", label: "Payments" },
  { id: "order.refunded", label: "Refunds" },
];

export function RevenueTransactionsTable({ transactions }: { transactions: RevenueTransaction[] }) {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((t) => t.type === filter)),
    [transactions, filter]
  );

  return (
    <div className="flex flex-col gap-4">
      <Tabs items={FILTERS} active={filter} onChange={setFilter} />
      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Real payments and refunds from Whop will show up here the moment the first one comes in."
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Customer</TableHeaderCell>
              <TableHeaderCell>Item</TableHeaderCell>
              <TableHeaderCell>Reason</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {filtered.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={txn.userName} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-heading">{txn.userName}</p>
                      <p className="truncate text-xs text-body">{txn.userEmail}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-body">{txn.itemLabel}</TableCell>
                <TableCell>
                  <Badge variant={txn.type === "order.refunded" ? "warning" : "success"}>
                    {txn.billingReason ?? (txn.type === "order.refunded" ? "Refund" : "Payment")}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right tabular-nums ${txn.amount < 0 ? "text-danger" : "text-heading"}`}>
                  {formatCurrency(txn.amount)}
                </TableCell>
                <TableCell className="text-body">{formatDate(txn.createdAt)}</TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
