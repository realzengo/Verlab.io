"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Info, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Panel } from "@/components/admin/Panel";
import { SegmentedControl } from "@/components/admin/SegmentedControl";
import { ADMIN_FIELD, ADMIN_HINT, ADMIN_LABEL } from "@/components/admin/AdminDialog";
import { PricingCard } from "@/components/pricing/PricingCard";
import { cn } from "@/lib/utils";
import { FREE_TEXT_MAX, NAME_MAX, SHORT_TEXT_MAX, isPlainTextSafe, isSafeFreeText } from "@/lib/validation";

const inputClass = ADMIN_FIELD;
const invalidClass = "border-danger focus-visible:border-danger";
const labelClass = ADMIN_LABEL;
const iconButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-(--admin-fill-strong) hover:text-heading disabled:pointer-events-none disabled:opacity-30";

const SAFE_TEXT_ERROR = (max: number) => `Must be ${max} characters or fewer and contain no HTML or control characters`;

type FieldErrors = Partial<Record<"name" | "cta" | "info" | "limits" | "features" | "priceMonthly" | "priceYearly", string>>;

function validatePlan(plan: PricingPlan): FieldErrors {
  const errors: FieldErrors = {};
  if (!plan.name.trim()) errors.name = "Required";
  else if (!isPlainTextSafe(plan.name, NAME_MAX)) errors.name = SAFE_TEXT_ERROR(NAME_MAX);
  if (!plan.cta.trim()) errors.cta = "Required";
  else if (!isPlainTextSafe(plan.cta, NAME_MAX)) errors.cta = SAFE_TEXT_ERROR(NAME_MAX);
  if (!plan.info.trim()) errors.info = "Required";
  else if (!isSafeFreeText(plan.info, FREE_TEXT_MAX)) errors.info = SAFE_TEXT_ERROR(FREE_TEXT_MAX);
  if (plan.limits && !isSafeFreeText(plan.limits, FREE_TEXT_MAX)) errors.limits = SAFE_TEXT_ERROR(FREE_TEXT_MAX);
  if (!Number.isFinite(plan.price.monthly) || plan.price.monthly < 0) errors.priceMonthly = "Must be 0 or more";
  if (!plan.monthlyOnly && (!Number.isFinite(plan.price.yearly) || plan.price.yearly < 0)) {
    errors.priceYearly = "Must be 0 or more";
  }
  const hasInvalidFeature = plan.features.some(
    (f) => !isPlainTextSafe(f.text, SHORT_TEXT_MAX) || (f.tooltip ? !isPlainTextSafe(f.tooltip, SHORT_TEXT_MAX) : false)
  );
  if (hasInvalidFeature) {
    errors.features = `Each feature text and tooltip ${SAFE_TEXT_ERROR(SHORT_TEXT_MAX)}`;
  }
  return errors;
}

function clonePlans(plans: PricingPlan[]): PricingPlan[] {
  return plans.map((p) => ({ ...p, price: { ...p.price }, features: p.features.map((f) => ({ ...f })) }));
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[12px] font-medium text-danger">{message}</p>;
}

/** A quiet aside under a group of fields. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] bg-(--admin-fill) px-3.5 py-3 text-[12.5px] leading-[1.5] text-subtle">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** One setting: what it does on the left, its switch on the right. */
function OptionRow({ title, description, control }: { title: string; description: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-heading">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-subtle">{description}</p>
      </div>
      {control}
    </div>
  );
}

export function PlansEditor({ initialPlans }: { initialPlans: PricingPlan[] }) {
  const [plans, setPlans] = useState<PricingPlan[]>(() => clonePlans(initialPlans));
  const [activeId, setActiveId] = useState(initialPlans[0].id);
  const [frequency, setFrequency] = useState<PricingFrequency>("monthly");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const activeIndex = plans.findIndex((p) => p.id === activeId);
  const active = plans[activeIndex];

  const isDirty = useMemo(() => JSON.stringify(plans) !== JSON.stringify(initialPlans), [plans, initialPlans]);
  const errorsByPlan = useMemo(() => new Map(plans.map((p) => [p.id, validatePlan(p)])), [plans]);
  const activeErrors = errorsByPlan.get(activeId) ?? {};
  const hasAnyErrors = useMemo(() => [...errorsByPlan.values()].some((e) => Object.keys(e).length > 0), [errorsByPlan]);

  useEffect(() => {
    if (!resetConfirm) return;
    const timeout = setTimeout(() => setResetConfirm(false), 3000);
    return () => clearTimeout(timeout);
  }, [resetConfirm]);

  function updateActive(patch: Partial<PricingPlan>) {
    setPlans((prev) => prev.map((p, i) => (i === activeIndex ? { ...p, ...patch } : p)));
    setSavedAt(null);
    setSaveError(null);
  }

  function updateFeature(featureIndex: number, patch: Partial<PricingPlan["features"][number]>) {
    updateActive({
      features: active.features.map((f, i) => (i === featureIndex ? { ...f, ...patch } : f)),
    });
  }

  function addFeature() {
    updateActive({ features: [...active.features, { text: "" }] });
  }

  function removeFeature(featureIndex: number) {
    updateActive({ features: active.features.filter((_, i) => i !== featureIndex) });
  }

  function moveFeature(featureIndex: number, direction: -1 | 1) {
    const target = featureIndex + direction;
    if (target < 0 || target >= active.features.length) return;
    const next = [...active.features];
    [next[featureIndex], next[target]] = [next[target], next[featureIndex]];
    updateActive({ features: next });
  }

  function requestReset() {
    if (!isDirty) return;
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    setPlans(clonePlans(initialPlans));
    setSavedAt(null);
    setSaveError(null);
    setResetConfirm(false);
  }

  async function save() {
    if (hasAnyErrors) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/plan-definitions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to save changes");
      }
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  const recommendedName = plans.find((p) => p.recommended)?.name;
  const status = saveError
    ? { tone: "bg-danger", text: saveError }
    : hasAnyErrors
      ? { tone: "bg-danger", text: "Fix the highlighted fields to save" }
      : isDirty
        ? { tone: "bg-warning", text: "Unsaved changes" }
        : savedAt
          ? { tone: "bg-success", text: "Saved and published" }
          : { tone: "bg-success", text: "Everything is published" };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel
          title="Plans"
          description={`${plans.length} tiers · ${recommendedName ? `${recommendedName} is recommended` : "none recommended"} · pick one to edit`}
        >
          <div className={cn("grid grid-cols-1 gap-3", plans.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {plans.map((p) => {
              const isActive = p.id === activeId;
              const hasError = Object.keys(errorsByPlan.get(p.id) ?? {}).length > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex min-w-0 flex-col rounded-xl px-4 py-3.5 text-left outline-none transition-[background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-primary/40",
                    isActive
                      ? "bg-[color-mix(in_srgb,var(--viz-1)_7%,transparent)] shadow-[inset_0_0_0_1.5px_var(--viz-1)]"
                      : "bg-(--admin-fill) shadow-[inset_0_0_0_1px_var(--color-hairline)] hover:bg-(--admin-fill-strong)"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-heading">{p.name || "Untitled"}</span>
                    {p.recommended && (
                      <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--viz-1)_14%,transparent)] px-2 py-0.5 text-[11px] font-medium text-primary">
                        Popular
                      </span>
                    )}
                    {hasError && (
                      <span aria-label="Has invalid fields" className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                    )}
                  </span>
                  <span className="mt-2.5 flex items-baseline gap-1">
                    <span className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-heading">${p.price.monthly}</span>
                    <span className="text-[12px] text-subtle">/ month</span>
                  </span>
                  <span className="mt-1.5 text-[12px] text-subtle">
                    {p.monthlyOnly ? "Monthly billing only" : `$${Math.round(p.price.yearly / 12)}/mo billed yearly`}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Details" description="Name, description and call to action" bodyClassName="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="plan-name">Plan name</label>
              <input
                id="plan-name"
                type="text"
                maxLength={NAME_MAX}
                value={active.name}
                onChange={(e) => updateActive({ name: e.target.value })}
                className={cn(inputClass, activeErrors.name && invalidClass)}
              />
              <FieldError message={activeErrors.name} />
            </div>
            <div>
              <label className={labelClass} htmlFor="plan-cta">Button label</label>
              <input
                id="plan-cta"
                type="text"
                maxLength={NAME_MAX}
                value={active.cta}
                onChange={(e) => updateActive({ cta: e.target.value })}
                className={cn(inputClass, activeErrors.cta && invalidClass)}
              />
              <FieldError message={activeErrors.cta} />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="plan-info">Description</label>
            <input
              id="plan-info"
              type="text"
              maxLength={FREE_TEXT_MAX}
              value={active.info}
              onChange={(e) => updateActive({ info: e.target.value })}
              className={cn(inputClass, activeErrors.info && invalidClass)}
            />
            <FieldError message={activeErrors.info} />
          </div>

          <div>
            <label className={labelClass} htmlFor="plan-limits">Limits note</label>
            <input
              id="plan-limits"
              type="text"
              maxLength={FREE_TEXT_MAX}
              value={active.limits ?? ""}
              onChange={(e) => updateActive({ limits: e.target.value || undefined })}
              placeholder="e.g. Up to 5 team seats"
              className={cn(inputClass, activeErrors.limits && invalidClass)}
            />
            {activeErrors.limits ? <FieldError message={activeErrors.limits} /> : <p className={ADMIN_HINT}>Optional. Shown under the price.</p>}
          </div>
        </Panel>

        <Panel title="Pricing" description="Shown on the pricing page and every in-app upgrade prompt" bodyClassName="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="plan-monthly">Monthly price</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                <input
                  id="plan-monthly"
                  type="number"
                  min={0}
                  value={active.price.monthly}
                  onChange={(e) => updateActive({ price: { ...active.price, monthly: Number(e.target.value) || 0 } })}
                  className={cn(inputClass, "pl-7 tabular-nums", activeErrors.priceMonthly && invalidClass)}
                />
              </div>
              {activeErrors.priceMonthly ? <FieldError message={activeErrors.priceMonthly} /> : <p className={ADMIN_HINT}>USD, charged every month.</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor="plan-yearly">Yearly price</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                <input
                  id="plan-yearly"
                  type="number"
                  min={0}
                  value={active.price.yearly}
                  disabled={active.monthlyOnly}
                  onChange={(e) => updateActive({ price: { ...active.price, yearly: Number(e.target.value) || 0 } })}
                  className={cn(
                    inputClass,
                    "pl-7 tabular-nums disabled:cursor-not-allowed disabled:opacity-50",
                    activeErrors.priceYearly && invalidClass
                  )}
                />
              </div>
              {activeErrors.priceYearly ? (
                <FieldError message={activeErrors.priceYearly} />
              ) : (
                <p className={ADMIN_HINT}>
                  {active.monthlyOnly ? "Off: this plan is monthly only." : `USD, billed once a year · about $${Math.round(active.price.yearly / 12)}/mo.`}
                </p>
              )}
            </div>
          </div>

          <Note>
            Saving updates the price on <span className="font-medium text-body">/pricing</span> and every upgrade prompt
            straight away. What checkout actually charges comes from the plan in Whop, so change both when you reprice.
          </Note>
        </Panel>

        <Panel title="Options">
          <div className="flex flex-col divide-y divide-hairline">
            <OptionRow
              title="Recommended"
              description="Adds the Popular badge. Only one plan can have it."
              control={
                <Switch
                  checked={!!active.recommended}
                  onChange={() =>
                    setPlans((prev) => prev.map((p, i) => ({ ...p, recommended: i === activeIndex ? !p.recommended : false })))
                  }
                  label="Mark as recommended"
                />
              }
            />
            <OptionRow
              title="Monthly billing only"
              description="Hides the yearly price for this plan."
              control={
                <Switch
                  checked={!!active.monthlyOnly}
                  onChange={() => updateActive({ monthlyOnly: !active.monthlyOnly })}
                  label="Monthly billing only"
                />
              }
            />
          </div>
        </Panel>

        <Panel
          title="Features"
          description={`Checklist on the ${active.name || "plan"} card, in this order`}
          action={
            <Button variant="secondary" size="sm" icon={Plus} onClick={addFeature}>
              Add feature
            </Button>
          }
        >
          <FieldError message={activeErrors.features} />
          {active.features.length === 0 ? (
            <p className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-hairline text-center text-[13px] text-subtle">
              No features yet. Add the first one.
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-hairline">
              {active.features.map((feature, i) => (
                <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-x-3 py-3 first:pt-0 last:pb-0">
                  <span className="pt-[11px] font-mono text-[11px] tabular-nums text-subtle">{String(i + 1).padStart(2, "0")}</span>
                  <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
                    <input
                      type="text"
                      maxLength={SHORT_TEXT_MAX}
                      value={feature.text}
                      onChange={(e) => updateFeature(i, { text: e.target.value })}
                      placeholder="Feature"
                      aria-label={`Feature ${i + 1}`}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      maxLength={SHORT_TEXT_MAX}
                      value={feature.tooltip ?? ""}
                      onChange={(e) => updateFeature(i, { tooltip: e.target.value || undefined })}
                      placeholder="Tooltip (optional)"
                      aria-label={`Feature ${i + 1} tooltip`}
                      className={cn(inputClass, "text-[13px]")}
                    />
                  </div>
                  <div className="flex items-center gap-0.5 pt-[3px]">
                    <button type="button" onClick={() => moveFeature(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up" className={iconButton}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFeature(i, 1)}
                      disabled={i === active.features.length - 1}
                      aria-label="Move down"
                      title="Move down"
                      className={iconButton}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFeature(i)}
                      aria-label="Remove feature"
                      title="Remove"
                      className={cn(iconButton, "hover:bg-danger-tint hover:text-danger")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {/* What's pending, and the way out. It floats over the editor only
            while there's something to save; otherwise it rests at the end. */}
        <div
          className={cn(
            "admin-float z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline py-2.5 pl-4 pr-2.5",
            isDirty || saveError ? "sticky bottom-4 shadow-[0_12px_32px_-12px_rgba(10,10,30,0.28)]" : "shadow-[0_1px_2px_rgba(10,10,30,0.04)]"
          )}
        >
          <p className="flex min-w-0 items-center gap-2 text-[13px] text-body" aria-live="polite">
            <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.tone)} />
            <span className="truncate">{status.text}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCcw}
              onClick={requestReset}
              disabled={!isDirty}
              className={cn(resetConfirm && "text-danger")}
            >
              {resetConfirm ? "Discard changes?" : "Reset"}
            </Button>
            <Button size="sm" icon={Save} onClick={save} disabled={isSaving || !isDirty || hasAnyErrors}>
              {isSaving ? "Saving…" : "Save and publish"}
            </Button>
          </div>
        </div>
      </div>

      <Panel
        className="xl:sticky xl:top-6 xl:self-start"
        title="Live preview"
        description="The card exactly as visitors see it"
        action={
          <SegmentedControl
            label="Preview billing frequency"
            items={[
              { id: "monthly", label: "Monthly" },
              { id: "yearly", label: "Yearly" },
            ]}
            active={frequency}
            onChange={(id) => setFrequency(id as PricingFrequency)}
          />
        }
        bodyClassName="flex flex-col gap-3"
      >
        {/* The marketing site always renders light, so the preview does too. */}
        <div className="overflow-hidden rounded-xl border border-hairline bg-[#eef0f4]">
          <div className="flex items-center gap-1.5 border-b border-black/5 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-black/15" />
            <span className="h-2 w-2 rounded-full bg-black/15" />
            <span className="h-2 w-2 rounded-full bg-black/15" />
            <span className="ml-2 flex-1 truncate rounded-md bg-white px-2.5 py-1 text-center text-[11px] font-medium text-slate-500">
              verlab.io/pricing
            </span>
          </div>
          <div className="bg-white p-5">
            <PricingCard plan={active} frequency={frequency} compact />
          </div>
        </div>
        <Button href="/pricing" variant="text" size="sm" icon={ExternalLink} iconPosition="right" target="_blank" className="self-start">
          Open pricing page
        </Button>
      </Panel>
    </div>
  );
}
