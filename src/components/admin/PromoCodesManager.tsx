"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Check, Copy, Plus, Ticket, Trash2, X } from "lucide-react";
import type { PromoCode, PromoRewardType } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { CODE_MAX, isValidCode } from "@/lib/validation";

const inputClass =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-heading outline-none placeholder:text-subtle focus:border-primary";
const labelClass = "mb-1.5 block text-xs font-medium text-body";

interface FormState {
  code: string;
  rewardType: PromoRewardType;
  rewardValue: string;
  maxUses: string;
  expiresAt: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  rewardType: "credits",
  rewardValue: "",
  maxUses: "",
  expiresAt: "",
};

function rewardLabel(code: PromoCode): string {
  return code.rewardType === "credits" ? `${formatNumber(code.rewardValue)} credits` : `${code.rewardValue}% off`;
}

function statusOf(code: PromoCode): { label: string; variant: "success" | "danger" } {
  if (!code.isActive) return { label: "Inactive", variant: "danger" };
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return { label: "Expired", variant: "danger" };
  return { label: "Active", variant: "success" };
}

export function PromoCodesManager({ initialCodes }: { initialCodes: PromoCode[] }) {
  const [codes, setCodes] = useState(initialCodes);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null);

  async function handleCopy(code: PromoCode) {
    await navigator.clipboard.writeText(code.code);
    setCopiedId(code.id);
    setTimeout(() => setCopiedId((current) => (current === code.id ? null : current)), 1500);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const res = await fetch(`/api/admin/promo-codes/${target.id}`, { method: "DELETE" });
    if (res.ok) {
      setCodes((prev) => prev.filter((c) => c.id !== target.id));
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function openModal() {
    setForm(EMPTY_FORM);
    setError(null);
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const rewardValue = Number(form.rewardValue);
    if (!isValidCode(form.code)) {
      setError("Code is required and may only contain letters, numbers, dashes, and underscores");
      return;
    }
    if (!Number.isInteger(rewardValue) || rewardValue <= 0) {
      setError("Reward value must be a whole number greater than 0");
      return;
    }
    if (form.maxUses.trim() && (!Number.isInteger(Number(form.maxUses)) || Number(form.maxUses) <= 0)) {
      setError("Max uses must be a whole number greater than 0");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code.trim(),
        rewardType: form.rewardType,
        rewardValue,
        maxUses: form.maxUses.trim() ? Number(form.maxUses) : null,
        expiresAt: form.expiresAt || null,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to create promo code");
      return;
    }

    setCodes((prev) => [data.code as PromoCode, ...prev]);
    closeModal();
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-heading">Promo Codes</h2>
          <p className="text-xs text-body">Manage discounts and credit grants.</p>
        </div>
        <Button icon={Plus} onClick={openModal}>
          Create Promo Code
        </Button>
      </div>

      <Card>
        {codes.length === 0 ? (
          <EmptyState icon={Ticket} title="No promo codes yet" description="Create a code to grant credits or a discount." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Code</TableHeaderCell>
                <TableHeaderCell>Reward</TableHeaderCell>
                <TableHeaderCell>Usage</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {codes.map((code) => {
                const status = statusOf(code);
                return (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-semibold text-heading">
                      <div className="flex items-center gap-2">
                        {code.code}
                        <button
                          type="button"
                          onClick={() => handleCopy(code)}
                          aria-label="Copy promo code"
                          className="text-subtle transition-colors hover:text-heading"
                        >
                          {copiedId === code.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-body">{rewardLabel(code)}</TableCell>
                    <TableCell className="tabular-nums text-body">
                      {formatNumber(code.usedCount)} / {code.maxUses == null ? "∞" : formatNumber(code.maxUses)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-body">{formatDate(code.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(code)}
                        aria-label="Delete promo code"
                        className="text-subtle transition-colors hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={closeModal}>
          <div className="w-full max-w-sm rounded-xl bg-surface shadow-card-hover" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-hairline p-5">
              <h2 className="text-lg font-semibold text-heading">Create promo code</h2>
              <button type="button" onClick={closeModal} aria-label="Close" className="text-body hover:text-heading">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4 p-5">
                <div>
                  <label className={labelClass}>Code</label>
                  <input
                    type="text"
                    required
                    maxLength={CODE_MAX}
                    value={form.code}
                    onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                    className={cn(inputClass, "uppercase")}
                    placeholder="e.g. LAUNCH50"
                  />
                </div>
                <div>
                  <label className={labelClass}>Reward type</label>
                  <select
                    value={form.rewardType}
                    onChange={(event) => setForm((prev) => ({ ...prev, rewardType: event.target.value as PromoRewardType }))}
                    className={inputClass}
                  >
                    <option value="credits">Free Credits</option>
                    <option value="discount_percent">% Discount</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Reward value</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={form.rewardValue}
                    onChange={(event) => setForm((prev) => ({ ...prev, rewardValue: event.target.value }))}
                    className={inputClass}
                    placeholder={form.rewardType === "credits" ? "e.g. 1000" : "e.g. 50"}
                  />
                </div>
                <div>
                  <label className={labelClass}>Max uses (optional)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.maxUses}
                    onChange={(event) => setForm((prev) => ({ ...prev, maxUses: event.target.value }))}
                    className={inputClass}
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className={labelClass}>Expiry date (optional)</label>
                  <DatePicker
                    value={form.expiresAt}
                    onChange={(value) => setForm((prev) => ({ ...prev, expiresAt: value }))}
                    placeholder="No expiry"
                  />
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
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete promo code"
        description={`Are you sure you want to delete "${deleteTarget?.code}"? This can't be undone.`}
        confirmLabel="Delete"
        danger
        icon={Trash2}
      />
    </>
  );
}
