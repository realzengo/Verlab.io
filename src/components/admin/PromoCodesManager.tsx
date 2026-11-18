"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Check, Copy, Plus, TicketPercent, Trash2 } from "lucide-react";
import type { PromoCode, PromoRewardType } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { Pagination, usePagination } from "@/components/admin/Pagination";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { ADMIN_BUTTON, ADMIN_FIELD, ADMIN_LABEL, AdminConfirmDialog, AdminDialog, AdminDialogBody, AdminDialogFooter } from "@/components/admin/AdminDialog";
import { Kpi, KpiStrip } from "@/components/admin/KpiStrip";
import { ReceiptIcon, TicketIcon, TrophyIcon } from "@phosphor-icons/react/dist/ssr";
import { formatStat } from "@/components/admin/charts/format";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { CODE_MAX, isValidCode } from "@/lib/validation";

const inputClass = ADMIN_FIELD;
const labelClass = ADMIN_LABEL;

const REWARD_TYPES: { value: PromoRewardType; label: string }[] = [
  { value: "credits", label: "Free credits" },
  { value: "discount_percent", label: "Percent discount" },
];

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

function statusOf(code: PromoCode): { label: string; variant: "success" | "warning" | "default" } {
  if (!code.isActive) return { label: "Inactive", variant: "default" };
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return { label: "Expired", variant: "warning" };
  return { label: "Active", variant: "success" };
}

export function PromoCodesManager({ initialCodes }: { initialCodes: PromoCode[] }) {
  const [codes, setCodes] = useState(initialCodes);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const liveCodes = codes.filter((c) => statusOf(c).label === "Active");
  const redemptions = codes.reduce((sum, c) => sum + c.usedCount, 0);
  const topCode = [...codes].sort((a, b) => b.usedCount - a.usedCount)[0];
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null);
  const { pageItems, pagerProps, setPage } = usePagination(codes, 10);

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
    setPage(1);
    closeModal();
  }

  return (
    <>
      <PageHeader title="Promo codes" description="Codes that grant credits or a discount at checkout.">
        <Button icon={Plus} onClick={openModal}>
          New code
        </Button>
      </PageHeader>

      <KpiStrip>
        <Kpi label="Active codes" value={formatStat(liveCodes.length)} footnote={`of ${formatNumber(codes.length)} created`} icon={TicketIcon} accent />
        <Kpi label="Redemptions" value={formatStat(redemptions)} footnote="across every code" icon={ReceiptIcon} />
        <Kpi
          label="Most redeemed"
          icon={TrophyIcon}
          value={topCode && topCode.usedCount > 0 ? topCode.code : "None yet"}
          footnote={topCode && topCode.usedCount > 0 ? `${formatNumber(topCode.usedCount)} uses` : undefined}
        />
      </KpiStrip>

      <Panel flush>
        {codes.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-subtle">No promo codes yet. Create one to grant credits or a discount.</p>
        ) : (
          <>
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
              {pageItems.map((code) => {
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
          <Pagination {...pagerProps} noun="codes" />
          </>
        )}
      </Panel>

      <AdminDialog
        open={isOpen}
        onClose={closeModal}
        title="Create promo code"
        description="Grants credits or a discount when redeemed at checkout"
        icon={TicketPercent}
      >
        <form onSubmit={handleSubmit}>
          <AdminDialogBody>
            <div>
              <label htmlFor="promo-code" className={labelClass}>
                Code
              </label>
              <input
                id="promo-code"
                type="text"
                required
                maxLength={CODE_MAX}
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                className={cn(inputClass, "font-mono uppercase tracking-[0.04em] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal")}
                placeholder="e.g. LAUNCH50"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
              <div>
                <span className={labelClass}>Reward type</span>
                <AdminSelect
                  label="Reward type"
                  value={form.rewardType}
                  onChange={(rewardType) => setForm((prev) => ({ ...prev, rewardType }))}
                  options={REWARD_TYPES}
                />
              </div>
              <div>
                <label htmlFor="promo-value" className={labelClass}>
                  {form.rewardType === "credits" ? "Credits" : "Percent off"}
                </label>
                <input
                  id="promo-value"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={form.rewardValue}
                  onChange={(event) => setForm((prev) => ({ ...prev, rewardValue: event.target.value }))}
                  className={cn(inputClass, "tabular-nums")}
                  placeholder={form.rewardType === "credits" ? "1000" : "50"}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="promo-max-uses" className={labelClass}>
                  Max uses <span className="font-normal text-subtle">· optional</span>
                </label>
                <input
                  id="promo-max-uses"
                  type="number"
                  min={1}
                  step={1}
                  value={form.maxUses}
                  onChange={(event) => setForm((prev) => ({ ...prev, maxUses: event.target.value }))}
                  className={cn(inputClass, "tabular-nums")}
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <span className={labelClass}>
                  Expires <span className="font-normal text-subtle">· optional</span>
                </span>
                <DatePicker
                  value={form.expiresAt}
                  onChange={(value) => setForm((prev) => ({ ...prev, expiresAt: value }))}
                  placeholder="No expiry"
                />
              </div>
            </div>
            {error && <p className="text-[13px] text-danger">{error}</p>}
          </AdminDialogBody>

          <AdminDialogFooter>
            <button type="button" onClick={closeModal} className={ADMIN_BUTTON.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={ADMIN_BUTTON.primary}>
              {submitting ? "Creating…" : "Create code"}
            </button>
          </AdminDialogFooter>
        </form>
      </AdminDialog>

      <AdminConfirmDialog
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
