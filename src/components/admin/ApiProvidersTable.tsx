"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ExternalLink, Plug, Plus, Trash2, TriangleAlert } from "lucide-react";
import type { ApiProvider } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { PageHeader } from "@/components/admin/PageHeader";
import { Callout, Panel } from "@/components/admin/Panel";
import { Kpi, KpiStrip } from "@/components/admin/KpiStrip";
import { KeyIcon, PlugIcon, WalletIcon } from "@phosphor-icons/react/dist/ssr";
import { BarList } from "@/components/admin/charts/BarList";
import { ADMIN_BUTTON, ADMIN_FIELD, ADMIN_LABEL, AdminConfirmDialog, AdminDialog, AdminDialogBody, AdminDialogFooter } from "@/components/admin/AdminDialog";
import { cn, formatCurrency } from "@/lib/utils";
import { NAME_MAX, SHORT_TEXT_MAX, URL_MAX, isPlainTextSafe, isValidName, isValidUrl } from "@/lib/validation";

const inputClass = ADMIN_FIELD;
const labelClass = ADMIN_LABEL;

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
  const activeProviders = providers.filter((p) => p.isActive);
  const missingKeys = providers.filter((p) => p.envVar && !p.configured);

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
      <PageHeader title="API costs" description="Every third-party API the product calls, and what each one costs per month.">
        <Button icon={Plus} onClick={openModal}>
          Add provider
        </Button>
      </PageHeader>

      {missingKeys.length > 0 && (
        <Callout
          icon={<TriangleAlert className="h-4 w-4" />}
          title={`${missingKeys.map((p) => p.name).join(", ")} ${missingKeys.length === 1 ? "has" : "have"} no API key on this deployment`}
        >
          Add {missingKeys.length === 1 ? "the env var" : "these env vars"} to enable{" "}
          {missingKeys.length === 1 ? "it" : "them"}:{" "}
          {missingKeys.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <code className="rounded bg-(--admin-fill-strong) px-1 py-0.5 font-mono text-[12px]">{p.envVar}</code>
            </span>
          ))}
        </Callout>
      )}

      <KpiStrip>
        <Kpi label="Monthly spend" value={formatCurrency(totalMonthly)} footnote={`${formatCurrency(totalMonthly * 12)} a year`} icon={WalletIcon} accent />
        <Kpi label="Active providers" value={activeProviders.length} footnote={`of ${providers.length} integrated`} icon={PlugIcon} />
        <Kpi
          label="Missing API keys"
          icon={KeyIcon}
          value={missingKeys.length}
          delta={
            missingKeys.length > 0
              ? { value: "Needs attention", sentiment: "negative" }
              : { value: "All configured", sentiment: "positive" }
          }
        />
      </KpiStrip>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* A summary rail beside a long table: its own height, kept in view
            while the table scrolls, rather than stretched to the table. */}
        <Panel title="Spend by provider" description="Active providers, per month" className="xl:sticky xl:top-6 xl:self-start">
          <BarList
            format="currency"
            items={[...activeProviders]
              .sort((a, b) => b.monthlyCost - a.monthlyCost)
              .map((p) => ({
                label: p.name,
                value: p.monthlyCost,
                detail: {
                  title: p.name,
                  subtitle: p.category,
                  rows: [
                    { label: "Monthly cost", value: formatCurrency(p.monthlyCost) },
                    { label: "Yearly", value: formatCurrency(p.monthlyCost * 12) },
                    {
                      label: "Share of spend",
                      value: totalMonthly > 0 ? `${Math.round((p.monthlyCost / totalMonthly) * 100)}%` : "0%",
                    },
                    { label: "API key", value: p.configured ? "Configured" : "Missing", tone: p.configured ? "good" : "bad" },
                    ...(p.envVar ? [{ label: "Env var", value: p.envVar, mono: true }] : []),
                    ...(p.websiteUrl ? [{ label: "Website", value: p.websiteUrl.replace(/^https?:\/\/(www\.)?/, ""), href: p.websiteUrl }] : []),
                  ],
                },
              }))}
            emptyLabel="No costs yet. Click a provider's cost in the table to enter it."
          />
        </Panel>

        <Panel className="xl:col-span-2" title="Providers" description="Click a cost to edit it" flush>
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
                    {provider.notes && <p className="mt-0.5 text-xs text-subtle">{provider.notes}</p>}
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
                        className="rounded-md px-2 py-1 font-semibold text-heading transition-colors hover:bg-(--admin-fill-strong)"
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
        </Panel>
      </div>

      <AdminDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Add API provider"
        description="Track what a provider costs each month"
        icon={Plug}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <AdminDialogBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="provider-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="provider-name"
                  type="text"
                  required
                  maxLength={NAME_MAX}
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className={inputClass}
                  placeholder="ElevenLabs"
                />
              </div>
              <div>
                <label htmlFor="provider-category" className={labelClass}>
                  Category
                </label>
                <input
                  id="provider-category"
                  type="text"
                  required
                  maxLength={NAME_MAX}
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  className={inputClass}
                  placeholder="AI / Media generation"
                />
              </div>
            </div>
            <div>
              <label htmlFor="provider-env" className={labelClass}>
                Env var <span className="font-normal text-subtle">· optional</span>
              </label>
              <input
                id="provider-env"
                type="text"
                maxLength={SHORT_TEXT_MAX}
                value={form.envVar}
                onChange={(event) => setForm((prev) => ({ ...prev, envVar: event.target.value }))}
                className={cn(inputClass, "font-mono text-[13px]")}
                placeholder="ELEVENLABS_API_KEY"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
              <div>
                <label htmlFor="provider-url" className={labelClass}>
                  Website <span className="font-normal text-subtle">· optional</span>
                </label>
                <input
                  id="provider-url"
                  type="url"
                  value={form.websiteUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, websiteUrl: event.target.value }))}
                  className={inputClass}
                  placeholder="https://"
                  maxLength={URL_MAX}
                />
              </div>
              <div>
                <label htmlFor="provider-cost" className={labelClass}>
                  Monthly cost
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                  <input
                    id="provider-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.monthlyCost}
                    onChange={(event) => setForm((prev) => ({ ...prev, monthlyCost: event.target.value }))}
                    className={cn(inputClass, "pl-6 tabular-nums")}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            {error && <p className="text-[13px] text-danger">{error}</p>}
          </AdminDialogBody>

          <AdminDialogFooter>
            <button type="button" onClick={() => setIsOpen(false)} className={ADMIN_BUTTON.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={ADMIN_BUTTON.primary}>
              {submitting ? "Adding…" : "Add provider"}
            </button>
          </AdminDialogFooter>
        </form>
      </AdminDialog>

      <AdminConfirmDialog
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
