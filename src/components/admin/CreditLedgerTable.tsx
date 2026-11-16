"use client";

import type { CreditLedgerEntry } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Panel } from "@/components/admin/Panel";
import { Pagination, usePagination } from "@/components/admin/Pagination";
import { formatDate, formatNumber } from "@/lib/utils";

export function CreditLedgerTable({ entries }: { entries: CreditLedgerEntry[] }) {
  const { pageItems, pagerProps } = usePagination(entries, 10);

  return (
    <Panel title="Ledger" description={`Latest ${formatNumber(entries.length)} entries across all users`} flush>
      {entries.length === 0 ? (
        <p className="border-t border-hairline px-5 py-12 text-center text-[13px] text-subtle">
          Credit charges, refunds and manual adjustments will show up here.
        </p>
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="pl-5">User</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                <TableHeaderCell className="pr-5 text-right">When</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {pageItems.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={tx.userName} size="sm" />
                      <span className="truncate font-medium text-heading">{tx.userName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-body">
                    {tx.feature}
                    {tx.grantedBy && <span className="ml-1.5 text-xs text-subtle">by {tx.grantedBy}</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={tx.amount < 0 ? "danger" : "success"}>
                      {tx.amount < 0 ? "−" : "+"}
                      {formatNumber(Math.abs(tx.amount))}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap pr-5 text-right text-body">{formatDate(tx.createdAt)}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
          <Pagination {...pagerProps} noun="entries" />
        </>
      )}
    </Panel>
  );
}
