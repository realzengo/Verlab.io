"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Coins, Minus, Plus, Search, X } from "lucide-react";
import type { CreditsAdminUser } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatNumber } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-heading outline-none placeholder:text-subtle focus:border-primary";
const labelClass = "mb-1.5 block text-xs font-medium text-body";

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

  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected]);

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
    <Card>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-heading">Manage user credits</h3>
          <p className="text-xs text-body">Search a user to grant or remove credits manually</p>
        </div>
      </div>

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
        <div className="flex flex-col divide-y divide-hairline">
          {filtered.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => openModal(user)}
              className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0"
            >
              <Avatar name={user.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-heading">{user.name}</p>
                <p className="truncate text-xs text-body">{user.email}</p>
              </div>
              <Badge variant="default">
                <Coins className="h-3 w-3" />
                {formatNumber(user.credits)}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={closeModal}>
          <div
            className="w-full max-w-sm rounded-xl bg-surface shadow-card-hover"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-hairline p-5">
              <div>
                <h2 className="text-lg font-semibold text-heading">Adjust credits</h2>
                <p className="text-xs text-body">
                  {selected.name} · {formatNumber(selected.credits)} credits
                </p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Close" className="text-body hover:text-heading">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4 p-5">
                <div>
                  <label className={labelClass}>Action</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDirection("grant")}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        direction === "grant"
                          ? "border-success/40 bg-success-tint text-success"
                          : "border-hairline text-body hover:bg-app"
                      )}
                    >
                      <Plus className="h-4 w-4" /> Grant
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("remove")}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        direction === "remove"
                          ? "border-danger/40 bg-danger-tint text-danger"
                          : "border-hairline text-body hover:bg-app"
                      )}
                    >
                      <Minus className="h-4 w-4" /> Remove
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Credits</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className={inputClass}
                    placeholder="e.g. 100"
                  />
                </div>
                <div>
                  <label className={labelClass}>Reason</label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className={inputClass}
                    placeholder="e.g. Support goodwill credit"
                  />
                  <p className="mt-1 text-[11px] text-subtle">Logged to the credit ledger for audit, tagged with your admin email.</p>
                </div>
                {error && <p className="text-xs text-danger">{error}</p>}
              </div>

              <div className="flex justify-end gap-3 border-t border-hairline p-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-body hover:bg-app"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-btn-primary px-4 py-2 text-sm font-medium text-white hover:bg-btn-primary-hover disabled:opacity-50"
                >
                  {submitting ? "Saving…" : direction === "grant" ? "Grant credits" : "Remove credits"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
