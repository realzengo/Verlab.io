"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
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

type JoinedFilter = "all" | "today" | "yesterday" | "7d" | "30d" | "90d" | "older";

const JOINED_FILTERS: { value: JoinedFilter; label: string }[] = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "older", label: "Over 90 days ago" },
];

/** The UTC day `days` before `nowIso`, as YYYY-MM-DD (signupDate's format). */
function dayOffset(nowIso: string, days: number): string {
  const d = new Date(nowIso);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive [from, to] day range for a joined filter; "Last 7 days" is today plus the 6 before. */
function joinedRange(filter: JoinedFilter, nowIso: string): [string, string] | null {
  const today = dayOffset(nowIso, 0);
  switch (filter) {
    case "all":
      return null;
    case "today":
      return [today, today];
    case "yesterday":
      return [dayOffset(nowIso, 1), dayOffset(nowIso, 1)];
    case "7d":
      return [dayOffset(nowIso, 6), today];
    case "30d":
      return [dayOffset(nowIso, 29), today];
    case "90d":
      return [dayOffset(nowIso, 89), today];
    case "older":
      return ["0000-00-00", dayOffset(nowIso, 90)];
  }
}

type SortKey = "name" | "mrr" | "signupDate" | "lastActiveAt";

// One collator for every name comparison: String#localeCompare builds a new
// one per call, which is most of the cost of sorting thousands of rows.
const nameCollator = new Intl.Collator(undefined, { sensitivity: "base" });

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
  const [joinedFilter, setJoinedFilter] = useState<JoinedFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("signupDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [overrides, setOverrides] = useState<Record<string, AdminUserStatus>>({});

  // Searching shrinks the table from a full page to a row or two, and the
  // page shrinking under the viewport made the browser yank the scroll up.
  // Hold the list at the height it had before narrowing so the search box
  // stays put; clearing the search and filters lets it size freely again.
  const shellRef = useRef<HTMLDivElement>(null);
  const [heldHeight, setHeldHeight] = useState<number | null>(null);
  const narrowed = query.trim() !== "" || planFilter !== "all" || statusFilter !== "all" || joinedFilter !== "all";
  function narrow<T>(set: (value: T) => void) {
    return (value: T) => {
      if (!narrowed) setHeldHeight(shellRef.current?.offsetHeight ?? null);
      set(value);
    };
  }

  // Search text and sort timestamps worked out once per user list, not on
  // every keystroke and every comparison -- the list runs to thousands.
  const indexed = useMemo(
    () =>
      users.map((u) => ({
        user: u,
        search: `${u.name}\n${u.email}`.toLowerCase(),
        signupTs: Date.parse(u.signupDate),
        lastActiveTs: Date.parse(u.lastActiveAt),
      })),
    [users]
  );

  // The input updates on every key; the filtering trails it at lower priority
  // so typing never waits on the table.
  const deferredQuery = useDeferredValue(query);
  const searchTerm = deferredQuery.trim().toLowerCase();

  const filtered = useMemo(() => {
    const joined = joinedRange(joinedFilter, nowIso);
    const list = indexed.filter(({ user: u, search }) => {
      if (joined) {
        const day = u.signupDate.slice(0, 10);
        if (day < joined[0] || day > joined[1]) return false;
      }
      if (planFilter !== "all" && u.plan !== planFilter) return false;
      if (statusFilter !== "all" && (overrides[u.id] ?? u.status) !== statusFilter) return false;
      if (searchTerm && !search.includes(searchTerm)) return false;
      return true;
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = nameCollator.compare(a.user.name, b.user.name);
      else if (sortKey === "mrr") cmp = a.user.mrr - b.user.mrr;
      else if (sortKey === "signupDate") cmp = a.signupTs - b.signupTs;
      else cmp = a.lastActiveTs - b.lastActiveTs;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list.map(({ user }) => (overrides[user.id] ? { ...user, status: overrides[user.id] } : user));
  }, [indexed, overrides, searchTerm, planFilter, statusFilter, joinedFilter, nowIso, sortKey, sortDir]);

  const { pageItems, pagerProps } = usePagination(
    filtered,
    PAGE_SIZE,
    [searchTerm, planFilter, statusFilter, joinedFilter, sortKey, sortDir].join("|")
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

  const suspendedCount = useMemo(
    () => users.filter((u) => (overrides[u.id] ?? u.status) === "suspended").length,
    [users, overrides]
  );
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
    <div ref={shellRef} style={narrowed && heldHeight ? { minHeight: heldHeight } : undefined}>
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
            onChange={(e) => narrow(setQuery)(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search users"
            className={cn(fieldClass, "w-full pl-8 pr-3")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdminSelect
            size="sm"
            label="Filter by date joined"
            prefix="Joined"
            value={joinedFilter}
            onChange={narrow(setJoinedFilter)}
            options={JOINED_FILTERS}
          />
          <AdminSelect
            size="sm"
            label="Filter by plan"
            prefix="Plan"
            value={planFilter}
            onChange={narrow(setPlanFilter)}
            options={PLAN_FILTERS}
          />
          <AdminSelect
            size="sm"
            align="right"
            label="Filter by status"
            prefix="Status"
            value={statusFilter}
            onChange={narrow(setStatusFilter)}
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
    </div>
  );
}
