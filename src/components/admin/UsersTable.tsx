"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Mail, Search, ShieldCheck, ShieldOff, Users as UsersIcon } from "lucide-react";
import type { AdminUser, AdminUserStatus } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatNumber, cn } from "@/lib/utils";

const STATUS_VARIANT: Record<AdminUserStatus, "success" | "warning" | "danger" | "default"> = {
  active: "success",
  trialing: "default",
  past_due: "warning",
  canceled: "default",
  suspended: "danger",
  free: "default",
};

const STATUS_LABEL: Record<AdminUserStatus, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Canceled",
  suspended: "Suspended",
  free: "Free",
};

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="w-full rounded-full border border-hairline bg-surface py-2 pl-9 pr-3.5 text-sm text-heading outline-none placeholder:text-subtle focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)}
            className="rounded-full border border-hairline bg-surface px-3.5 py-2 text-sm text-heading outline-none focus:border-primary"
          >
            <option value="all">All plans</option>
            <option value="free">Free</option>
            <option value="core">Core</option>
            <option value="pro">Pro</option>
            <option value="scale">Scale</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-full border border-hairline bg-surface px-3.5 py-2 text-sm text-heading outline-none focus:border-primary"
          >
            <option value="all">All statuses</option>
            <option value="free">Free</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past due</option>
            <option value="canceled">Canceled</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-body">
        Showing {filtered.length} of {users.length} recent users
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users match" description="Try a different search term or clear the filters." />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>
                <button type="button" onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-heading">
                  User <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHeaderCell>
              <TableHeaderCell>Plan</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>
                <button type="button" onClick={() => toggleSort("mrr")} className="flex items-center gap-1 hover:text-heading">
                  MRR <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHeaderCell>
              <TableHeaderCell>Usage (bends / transcripts)</TableHeaderCell>
              <TableHeaderCell>
                <button type="button" onClick={() => toggleSort("signupDate")} className="flex items-center gap-1 hover:text-heading">
                  Signed up <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHeaderCell>
              <TableHeaderCell>
                <button type="button" onClick={() => toggleSort("lastActiveAt")} className="flex items-center gap-1 hover:text-heading">
                  Last active <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {filtered.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-heading">{user.name}</p>
                      <p className="truncate text-xs text-body">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="capitalize">{user.plan}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[user.status]}>{STATUS_LABEL[user.status]}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">${user.mrr}</TableCell>
                <TableCell className="tabular-nums text-body">
                  {formatNumber(user.usage.bends)} / {formatNumber(user.usage.transcripts)}
                </TableCell>
                <TableCell className="text-body">{formatDate(user.signupDate)}</TableCell>
                <TableCell className="text-body">{timeAgoFromNow(user.lastActiveAt, nowIso)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <a
                      href={`mailto:${user.email}`}
                      aria-label={`Email ${user.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-body hover:bg-app hover:text-heading"
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleSuspend(user)}
                      aria-label={user.status === "suspended" ? `Reactivate ${user.name}` : `Suspend ${user.name}`}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg hover:bg-app",
                        user.status === "suspended" ? "text-success hover:text-success" : "text-body hover:text-danger"
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
      )}
    </div>
  );
}
