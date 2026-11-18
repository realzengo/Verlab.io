"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ChevronRight, Coins, Minus, Plus, Search } from "lucide-react";
import type { CreditsAdminUser } from "@/lib/types";
import { Panel } from "@/components/admin/Panel";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { ADMIN_BUTTON, ADMIN_FIELD, ADMIN_HINT, ADMIN_LABEL, AdminDialog, AdminDialogBody, AdminDialogFooter } from "@/components/admin/AdminDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { REASON_MAX, isPlainTextSafe } from "@/lib/validation";

const inputClass = ADMIN_FIELD;
const labelClass = ADMIN_LABEL;

type Direction = "grant" | "remove";

export function ManageUserCreditsCard({ initialUsers }: { initialUsers: CreditsAdminUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CreditsAdminUser | null>(null);
  const [direction, setDirection] = useState<Direction>("grant");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;
    return pool.slice(0, 8);
  }, [users, query]);

  function openModal(user: CreditsAdminUser) {
    setSelected(user);
    setDirection("grant");
    setAmount("");
    setReason("");
    setError(null);
  }

  function closeModal() {
    setSelected(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;

    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a whole number of credits greater than 0");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required for the audit log");
      return;
    }
    if (!isPlainTextSafe(reason.trim(), REASON_MAX)) {
      setError(`Reason must be ${REASON_MAX} characters or fewer and contain no HTML or control characters`);
      return;
    }

    setSubmitting(true);
    setError(null);
    const delta = direction === "grant" ? parsedAmount : -parsedAmount;

    const res = await fetch("/api/admin/credits/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selected.id, delta, reason: reason.trim() }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to adjust credits");
      return;
    }

    setUsers((prev) => prev.map((u) => (u.id === selected.id ? { ...u, credits: data.balance } : u)));
    closeModal();
  }

  return (
    <Panel title="Manage user credits" description="Search for someone to grant or remove credits by hand">

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email…"
          className={cn(inputClass, "pl-9")}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Coins} title="No users found" description="Try a different name or email." />
      ) : (
        <div className="flex flex-col">
          {filtered.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => openModal(user)}
              className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-(--admin-fill)"
            >
              <UserAvatar name={user.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-heading">{user.name}</p>
                <p className="truncate text-xs text-subtle">{user.email}</p>
              </div>
              <span className="shrink-0 text-[13px] tabular-nums">
                <span className="font-medium text-heading">{exact(user.credits)}</span>
                <span className="text-subtle"> credits</span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 -translate-x-1 text-subtle opacity-0 transition-[opacity,translate] duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      )}

      <AdminDialog
        open={selected !== null}
        onClose={closeModal}
        title="Adjust credits"
        description={selected ? `${selected.name} · ${exact(selected.credits)} credits` : undefined}
        media={selected ? <UserAvatar name={selected.name} size="md" className="h-10 w-10" /> : undefined}
      >
        {selected && (
          <form onSubmit={handleSubmit}>
            <AdminDialogBody>
              <div>
                <span className={labelClass}>Action</span>
                <div role="group" aria-label="Action" className="grid grid-cols-2 gap-1 rounded-[10px] bg-(--admin-fill-strong) p-1">
                  {(["grant", "remove"] as const).map((d) => {
                    const on = direction === d;
                    const Icon = d === "grant" ? Plus : Minus;
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDirection(d)}
                        className={cn(
                          "flex h-8 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors",
                          on
                            ? cn(
                                "bg-surface shadow-[0_0_0_1px_var(--color-hairline),0_1px_2px_rgba(10,10,30,0.06)] dark:bg-white/[0.08]",
                                d === "grant" ? "text-success" : "text-danger"
                              )
                            : "text-subtle hover:text-heading"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {d === "grant" ? "Grant" : "Remove"}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="adjust-credits-amount" className={labelClass}>
                  Credits
                </label>
                <input
                  id="adjust-credits-amount"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={cn(inputClass, "tabular-nums")}
                  placeholder="e.g. 100"
                />
              </div>
              <div>
                <label htmlFor="adjust-credits-reason" className={labelClass}>
                  Reason
                </label>
                <input
                  id="adjust-credits-reason"
                  type="text"
                  required
                  maxLength={REASON_MAX}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className={inputClass}
                  placeholder="e.g. Support goodwill credit"
                />
                <p className={ADMIN_HINT}>Logged to the credit ledger for audit, tagged with your admin email.</p>
              </div>
              {error && <p className="text-[13px] text-danger">{error}</p>}
            </AdminDialogBody>

            <AdminDialogFooter note={<BalancePreview current={selected.credits} amount={amount} direction={direction} />}>
              <button type="button" onClick={closeModal} className={ADMIN_BUTTON.secondary}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className={direction === "grant" ? ADMIN_BUTTON.primary : ADMIN_BUTTON.danger}>
                {submitting ? "Saving…" : direction === "grant" ? "Grant credits" : "Remove credits"}
              </button>
            </AdminDialogFooter>
          </form>
        )}
      </AdminDialog>
    </Panel>
  );
}

/** Every credit counts when adjusting a balance, so no "1.2K" rounding here. */
const exact = (n: number) => n.toLocaleString("en-US");

/** Where the balance lands if the form is submitted as it stands. */
function BalancePreview({ current, amount, direction }: { current: number; amount: string; direction: Direction }) {
  const n = Number(amount);
  if (!amount || !Number.isInteger(n) || n <= 0) return null;
  const next = direction === "grant" ? current + n : current - n;
  // The server refuses to take a balance below zero, so say so up front.
  if (next < 0) return <span className="text-danger">More than their balance</span>;
  return (
    <span className="tabular-nums">
      {exact(current)} → <span className="font-medium text-heading">{exact(next)}</span>
    </span>
  );
}
