"use client";

import { useState } from "react";

import type { CreditLedgerEntry } from "@/lib/types";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Panel } from "@/components/admin/Panel";
import { Pagination, usePagination } from "@/components/admin/Pagination";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { DetailDialog } from "@/components/admin/DetailDialog";
import type { DetailSpec } from "@/components/admin/details";

/** Local date and time, for the dialog (rendered on the client only). */
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const signedCredits = (n: number) => `${n < 0 ? "−" : "+"}${formatNumber(Math.abs(n))}`;

function ledgerDetail(tx: CreditLedgerEntry): DetailSpec {
  return {
    title: tx.feature,
    subtitle: `${tx.userName} · ${tx.userEmail}`,
    rows: [
      { label: tx.amount < 0 ? "Charged" : "Added", value: `${signedCredits(tx.amount)} credits`, tone: tx.amount < 0 ? "bad" : "good" },
      { label: "Action", value: tx.feature },
      ...(tx.actionKey ? [{ label: "Action key", value: tx.actionKey, mono: true }] : []),
      { label: "Granted by", value: tx.grantedBy ?? "Automatic", tone: tx.grantedBy ? "default" : "muted" },
      { label: "When", value: when(tx.createdAt) },
      { label: "Entry ID", value: tx.id, mono: true },
    ],
  };
}

export function CreditLedgerTable({ entries }: { entries: CreditLedgerEntry[] }) {
  const { pageItems, pagerProps } = usePagination(entries, 10);
  const [selected, setSelected] = useState<CreditLedgerEntry | null>(null);

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
                <TableRow key={tx.id} onClick={() => setSelected(tx)} className="cursor-pointer">
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={tx.userName} size="sm" />
                      <button type="button" className="truncate rounded font-medium text-heading outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
                        {tx.userName}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-body">
                    {tx.feature}
                    {tx.grantedBy && <span className="ml-1.5 text-xs text-subtle">by {tx.grantedBy}</span>}
                  </TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", tx.amount < 0 ? "text-heading" : "text-success")}>
                    {signedCredits(tx.amount)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap pr-5 text-right text-body">{formatDate(tx.createdAt)}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
          <Pagination {...pagerProps} noun="entries" />
        </>
      )}
      <DetailDialog
        spec={selected && ledgerDetail(selected)}
        onClose={() => setSelected(null)}
        media={selected ? <UserAvatar name={selected.userName} size="md" className="h-10 w-10" /> : undefined}
      />
    </Panel>
  );
}
