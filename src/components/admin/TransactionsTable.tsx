"use client";

import { useMemo, useState } from "react";
import type { Transaction, TransactionStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT: Record<TransactionStatus, "success" | "danger" | "warning"> = {
  paid: "success",
  failed: "danger",
  refunded: "warning",
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "failed", label: "Failed" },
  { id: "refunded", label: "Refunded" },
];

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((t) => t.status === filter)),
    [transactions, filter]
  );

  return (
    <div className="flex flex-col gap-4">
      <Tabs items={FILTERS} active={filter} onChange={setFilter} />
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>User</TableHeaderCell>
            <TableHeaderCell>Plan</TableHeaderCell>
            <TableHeaderCell>Amount</TableHeaderCell>
            <TableHeaderCell>Method</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Date</TableHeaderCell>
          </TableRow>
        </TableHead>
        <tbody>
          {filtered.map((txn) => (
            <TableRow key={txn.id}>
              <TableCell className="font-medium">{txn.userName}</TableCell>
              <TableCell className="capitalize text-body">{txn.plan}</TableCell>
              <TableCell className="tabular-nums">${txn.amount}</TableCell>
              <TableCell className="capitalize text-body">{txn.method}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[txn.status]}>{txn.status}</Badge>
              </TableCell>
              <TableCell className="text-body">{formatDate(txn.date)}</TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
