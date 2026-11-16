"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Mail, Search, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import type { AdminUser, AdminUserStatus } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Panel } from "@/components/admin/Panel";
import { Pagination, usePagination } from "@/components/admin/Pagination";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { formatCurrency, formatDate, formatNumber, cn } from "@/lib/utils";

// Plain account states stay gray, so the blue tint is left for trials and
// color for states that need attention.
const STATUS_VARIANT: Record<AdminUserStatus, "success" | "warning" | "danger" | "default" | "neutral"> = {
  active: "success",
  trialing: "default",
  past_due: "warning",
  canceled: "neutral",
  suspended: "danger",
  free: "neutral",
};

const STATUS_LABEL: Record<AdminUserStatus, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Canceled",
  suspended: "Suspended",
  free: "Free",
};

const PAGE_SIZE = 25;

const PLAN_FILTERS: { value: "all" | AdminUser["plan"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "free", label: "Free" },
  { value: "core", label: "Core" },
  { value: "pro", label: "Pro" },
  { value: "scale", label: "Scale" },
];

const STATUS_FILTERS: { value: "all" | AdminUserStatus; label: string }[] = [
  { value: "all", label: "All" },
  ...(["free", "active", "trialing", "past_due", "canceled", "suspended"] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
];

type SortKey = "name" | "mrr" | "signupDate" | "lastActiveAt";

function timeAgoFromNow(iso: string, nowIso: string): string {
  const hours = Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function UsersTable({ users, nowIso }: { users: AdminUser[]; nowIso: string }) {
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | AdminUser["plan"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminUserStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("signupDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [overrides, setOverrides] = useState<Record<string, AdminUserStatus>>({});

  const rows = useMemo(() => users.map((u) => ({ ...u, status: overrides[u.id] ?? u.status })), [users, overrides]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((u) => {
      if (planFilter !== "all" && u.plan !== planFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "mrr") cmp = a.mrr - b.mrr;
      else cmp = new Date(a[sortKey]).getTime() - new Date(b[sortKey]).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, query, planFilter, statusFilter, sortKey, sortDir]);

  const { pageItems, pagerProps } = usePagination(
    filtered,
    PAGE_SIZE,
    [query.trim().toLowerCase(), planFilter, statusFilter, sortKey, sortDir].join("|")
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function toggleSuspend(user: AdminUser) {
    setOverrides((prev) => ({
      ...prev,
      [user.id]: (overrides[user.id] ?? user.status) === "suspended" ? "active" : "suspended",
    }));
  }

  const suspendedCount = rows.filter((u) => u.status === "suspended").length;
  const fieldClass =
    "h-8 border border-hairline bg-surface text-[13px] text-heading outline-none placeholder:text-subtle focus:border-primary";

  const sortButton = (k: SortKey, label: string) => {
    const Icon = sortKey !== k ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-heading", sortKey === k && "text-heading")}
      >
        {label}
        <Icon className={cn("h-3 w-3", sortKey !== k && "opacity-50")} aria-hidden="true" />
      </button>
    );
  };

  return (
    <Panel
      title="All users"
      description={
        filtered.length === users.length
          ? `${users.length.toLocaleString("en-US")} accounts`
          : `${filtered.length.toLocaleString("en-US")} of ${users.length.toLocaleString("en-US")} accounts match`
      }
      action={
        suspendedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-tint px-2.5 py-1 text-xs font-medium text-danger">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            {suspendedCount} suspended
          </span>
        )
      }
      flush
    >
      <div className="flex flex-col gap-2 px-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search users"
            className={cn(fieldClass, "w-full pl-8 pr-3")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdminSelect
            size="sm"
            label="Filter by plan"
            prefix="Plan"
            value={planFilter}
            onChange={setPlanFilter}
            options={PLAN_FILTERS}
          />
          <AdminSelect
            size="sm"
            align="right"
            label="Filter by status"
            prefix="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="border-t border-hairline px-5 py-12 text-center text-[13px] text-subtle">
          No users match. Try a different search or clear the filters.
        </p>
      ) : (
        <>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell className="pl-5">
                {sortButton("name", "User")}
              </TableHeaderCell>
              <TableHeaderCell>Plan</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">
                {sortButton("mrr", "MRR")}
              </TableHeaderCell>
              <TableHeaderCell className="text-right">Bends / transcripts</TableHeaderCell>
              <TableHeaderCell>
                {sortButton("signupDate", "Signed up")}
              </TableHeaderCell>
              <TableHeaderCell>
                {sortButton("lastActiveAt", "Last active")}
              </TableHeaderCell>
              <TableHeaderCell className="pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {pageItems.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-heading">{user.name}</p>
                      <p className="truncate text-xs text-subtle">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="capitalize text-body">{user.plan}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[user.status]}>{STATUS_LABEL[user.status]}</Badge>
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", user.mrr > 0 ? "font-medium text-heading" : "text-subtle")}>
                  {formatCurrency(user.mrr)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-body">
                  {formatNumber(user.usage.bends)} / {formatNumber(user.usage.transcripts)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-body">{formatDate(user.signupDate)}</TableCell>
                <TableCell className="whitespace-nowrap text-body">{timeAgoFromNow(user.lastActiveAt, nowIso)}</TableCell>
                <TableCell className="pr-5">
                  <div className="flex items-center justify-end gap-1">
                    <a
                      href={`mailto:${user.email}`}
                      aria-label={`Email ${user.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-subtle hover:bg-(--admin-fill-strong) hover:text-heading"
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleSuspend(user)}
                      aria-label={user.status === "suspended" ? `Reactivate ${user.name}` : `Suspend ${user.name}`}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md hover:bg-(--admin-fill-strong)",
                        user.status === "suspended" ? "text-success hover:text-success" : "text-subtle hover:text-danger"
                      )}
                    >
                      {user.status === "suspended" ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
        <Pagination {...pagerProps} noun="accounts" />
        </>
      )}
    </Panel>
  );
}
