"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ExternalLink, Plug, Plus, Trash2, X } from "lucide-react";
import type { ApiProvider } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { cn, formatCurrency } from "@/lib/utils";
import { NAME_MAX, SHORT_TEXT_MAX, URL_MAX, isPlainTextSafe, isValidName, isValidUrl } from "@/lib/validation";

const inputClass =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-heading outline-none placeholder:text-subtle focus:border-primary";
const labelClass = "mb-1.5 block text-xs font-medium text-body";

interface FormState {
  name: string;
  category: string;
  envVar: string;
  websiteUrl: string;
  monthlyCost: string;
}

const EMPTY_FORM: FormState = { name: "", category: "", envVar: "", websiteUrl: "", monthlyCost: "" };

export function ApiProvidersTable({ initialProviders }: { initialProviders: ApiProvider[] }) {
  const [providers, setProviders] = useState(initialProviders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCost, setDraftCost] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiProvider | null>(null);

  const totalMonthly = useMemo(() => providers.filter((p) => p.isActive).reduce((sum, p) => sum + p.monthlyCost, 0), [providers]);

  function startEdit(provider: ApiProvider) {
    setEditingId(provider.id);
    setDraftCost(String(provider.monthlyCost));
  }

  async function commitEdit(provider: ApiProvider) {
    const nextCost = Number(draftCost);
    setEditingId(null);
    if (!Number.isFinite(nextCost) || nextCost < 0 || nextCost === provider.monthlyCost) return;

    setProviders((prev) => prev.map((p) => (p.id === provider.id ? { ...p, monthlyCost: nextCost } : p)));

    const res = await fetch("/api/admin/api-providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: provider.id, monthlyCost: nextCost }),
    });

    if (!res.ok) {
      setProviders((prev) => prev.map((p) => (p.id === provider.id ? provider : p)));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const res = await fetch(`/api/admin/api-providers?id=${encodeURIComponent(target.id)}`, { method: "DELETE" });
    if (res.ok) {
      setProviders((prev) => prev.filter((p) => p.id !== target.id));
    }
  }

  function openModal() {
    setForm(EMPTY_FORM);
    setError(null);
    setIsOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!isValidName(form.name, NAME_MAX)) {
      setError("Name is required and contains invalid characters or is too long");
      return;
    }
    if (!isValidName(form.category, NAME_MAX)) {
      setError("Category is required and contains invalid characters or is too long");
      return;
    }
    if (form.envVar.trim() && !isPlainTextSafe(form.envVar.trim(), SHORT_TEXT_MAX)) {
      setError("Env var contains invalid characters or is too long");
      return;
    }
    if (form.websiteUrl.trim() && !isValidUrl(form.websiteUrl.trim())) {
      setError("Website must be a valid http(s) URL");
      return;
    }
    const monthlyCost = form.monthlyCost.trim() ? Number(form.monthlyCost) : 0;
    if (!Number.isFinite(monthlyCost) || monthlyCost < 0) {
      setError("Monthly cost must be a non-negative number");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/api-providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        category: form.category.trim(),
        envVar: form.envVar.trim() || null,
        websiteUrl: form.websiteUrl.trim() || null,
        monthlyCost,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to add provider");
      return;
    }

    setProviders((prev) => [...prev, data.provider as ApiProvider]);
    setIsOpen(false);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-heading">API providers</h2>
          <p className="text-xs text-body">Every third-party API this app calls, and what you expect to pay each one per month.</p>
        </div>
        <Button icon={Plus} onClick={openModal}>
          Add provider
        </Button>
      </div>

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Provider</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Monthly cost</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {providers.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-heading">{provider.name}</p>
                    {provider.websiteUrl && (
                      <a
                        href={provider.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${provider.name} website`}
                        className="text-subtle transition-colors hover:text-heading"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  {provider.notes && <p className="mt-0.5 text-xs text-body">{provider.notes}</p>}
                </TableCell>
                <TableCell className="text-body">{provider.category}</TableCell>
                <TableCell>
                  <Badge variant={provider.configured ? "success" : "warning"}>
                    {provider.configured ? "Configured" : provider.envVar ? "Missing key" : "N/A"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {editingId === provider.id ? (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      autoFocus
                      value={draftCost}
                      onChange={(event) => setDraftCost(event.target.value)}
                      onBlur={() => commitEdit(provider)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                        if (event.key === "Escape") setEditingId(null);
                      }}
                      className={cn(inputClass, "ml-auto w-28 text-right")}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(provider)}
                      className="rounded-md px-2 py-1 font-semibold text-heading transition-colors hover:bg-app"
                    >
                      {formatCurrency(provider.monthlyCost)}
                    </button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(provider)}
                    aria-label={`Remove ${provider.name}`}
                    className="text-subtle transition-colors hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <TableCell colSpan={3} className="font-semibold text-heading">
                Total (active providers)
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-heading">{formatCurrency(totalMonthly)}</TableCell>
              <TableCell>{null}</TableCell>
            </tr>
          </tfoot>
        </Table>
      </Card>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-surface shadow-card-hover" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-hairline p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-heading">
                <Plug className="h-4.5 w-4.5" />
                Add API provider
              </h2>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close" className="text-body hover:text-heading">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4 p-5">
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    type="text"
                    required
                    maxLength={NAME_MAX}
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className={inputClass}
                    placeholder="e.g. ElevenLabs"
                  />
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <input
                    type="text"
                    required
                    maxLength={NAME_MAX}
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                    className={inputClass}
                    placeholder="e.g. AI / Media generation"
                  />
                </div>
                <div>
                  <label className={labelClass}>Env var (optional)</label>
                  <input
                    type="text"
                    maxLength={SHORT_TEXT_MAX}
                    value={form.envVar}
                    onChange={(event) => setForm((prev) => ({ ...prev, envVar: event.target.value }))}
                    className={cn(inputClass, "font-mono")}
                    placeholder="e.g. ELEVENLABS_API_KEY"
                  />
                </div>
                <div>
                  <label className={labelClass}>Website (optional)</label>
                  <input
                    type="url"
                    value={form.websiteUrl}
                    onChange={(event) => setForm((prev) => ({ ...prev, websiteUrl: event.target.value }))}
                    className={inputClass}
                    placeholder="https://"
                    maxLength={URL_MAX}
                  />
                </div>
                <div>
                  <label className={labelClass}>Monthly cost</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.monthlyCost}
                    onChange={(event) => setForm((prev) => ({ ...prev, monthlyCost: event.target.value }))}
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
                {error && <p className="text-xs text-danger">{error}</p>}
              </div>

              <div className="flex justify-end gap-3 border-t border-hairline p-5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-body hover:bg-app"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-btn-primary px-4 py-2 text-sm font-medium text-white hover:bg-btn-primary-hover disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Add provider"}
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
        title="Remove provider"
        description={`Remove "${deleteTarget?.name}" from the API cost tracker? This can't be undone.`}
        confirmLabel="Remove"
        danger
        icon={Trash2}
      />
    </>
  );
}
