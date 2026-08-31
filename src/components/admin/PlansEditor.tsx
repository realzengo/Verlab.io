"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  ExternalLink,
  Info,
  ListChecks,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { PricingCard } from "@/components/pricing/PricingCard";
import { cn } from "@/lib/utils";
import { FREE_TEXT_MAX, NAME_MAX, SHORT_TEXT_MAX, isPlainTextSafe, isSafeFreeText } from "@/lib/validation";

const inputClass =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-heading outline-none placeholder:text-subtle focus:border-primary";
const labelClass = "mb-1.5 block text-xs font-medium text-body";

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

function SectionHeading({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        {subtitle && <p className="text-xs text-body">{subtitle}</p>}
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] font-medium text-danger">{message}</p>;
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

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{plans.length} plans</Badge>
          <Badge>Recommended: {plans.find((p) => p.recommended)?.name || "None set"}</Badge>
          {isDirty ? <Badge variant="warning">Unsaved changes</Badge> : savedAt && <Badge variant="success">Saved</Badge>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {plans.map((p) => {
            const isActive = p.id === activeId;
            const hasError = Object.keys(errorsByPlan.get(p.id) ?? {}).length > 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveId(p.id)}
                className={cn(
                  "group relative flex flex-col gap-1.5 rounded-card-sm border p-4 text-left shadow-card transition-all",
                  isActive
                    ? "border-primary bg-accent"
                    : "border-hairline bg-surface hover:-translate-y-px hover:border-primary/40 hover:shadow-card-hover"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-heading">{p.name || "Untitled"}</span>
                  {p.recommended && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                      Popular
                    </span>
                  )}
                  {hasError && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                      title="This plan has invalid fields"
                    />
                  )}
                </div>
                <p className="text-xl font-bold leading-none tabular-nums text-heading">
                  ${p.price.monthly}
                  <span className="text-xs font-medium text-subtle">/mo</span>
                </p>
                {!p.monthlyOnly && (
                  <p className="text-[11px] text-subtle">${Math.round(p.price.yearly / 12)}/mo billed yearly</p>
                )}
              </button>
            );
          })}
        </div>

        <Card className="flex flex-col gap-5">
          <SectionHeading icon={Sparkles} title="Plan details" subtitle="Name, description, and call to action" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Plan name</label>
              <input
                type="text"
                maxLength={NAME_MAX}
                value={active.name}
                onChange={(e) => updateActive({ name: e.target.value })}
                className={cn(inputClass, activeErrors.name && "border-danger focus:border-danger")}
              />
              <FieldError message={activeErrors.name} />
            </div>
            <div>
              <label className={labelClass}>Call to action</label>
              <input
                type="text"
                maxLength={NAME_MAX}
                value={active.cta}
                onChange={(e) => updateActive({ cta: e.target.value })}
                className={cn(inputClass, activeErrors.cta && "border-danger focus:border-danger")}
              />
              <FieldError message={activeErrors.cta} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <input
              type="text"
              maxLength={FREE_TEXT_MAX}
              value={active.info}
              onChange={(e) => updateActive({ info: e.target.value })}
              className={cn(inputClass, activeErrors.info && "border-danger focus:border-danger")}
            />
            <FieldError message={activeErrors.info} />
          </div>

          <div>
            <label className={labelClass}>Limits note (optional, shown under the price)</label>
            <input
              type="text"
              maxLength={FREE_TEXT_MAX}
              value={active.limits ?? ""}
              onChange={(e) => updateActive({ limits: e.target.value || undefined })}
              placeholder="e.g. Up to 5 team seats"
              className={cn(inputClass, activeErrors.limits && "border-danger focus:border-danger")}
            />
            <FieldError message={activeErrors.limits} />
          </div>
        </Card>

        <Card className="flex flex-col gap-5">
          <SectionHeading icon={DollarSign} title="Pricing" subtitle="Shown on the public pricing page and in-app upgrade prompts" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Monthly price (USD)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                <input
                  type="number"
                  min={0}
                  value={active.price.monthly}
                  onChange={(e) => updateActive({ price: { ...active.price, monthly: Number(e.target.value) || 0 } })}
                  className={cn(inputClass, "pl-6 tabular-nums", activeErrors.priceMonthly && "border-danger focus:border-danger")}
                />
              </div>
              <FieldError message={activeErrors.priceMonthly} />
            </div>
            <div>
              <label className={labelClass}>Yearly price, billed annually (USD)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                <input
                  type="number"
                  min={0}
                  value={active.price.yearly}
                  disabled={active.monthlyOnly}
                  onChange={(e) => updateActive({ price: { ...active.price, yearly: Number(e.target.value) || 0 } })}
                  className={cn(
                    inputClass,
                    "pl-6 tabular-nums",
                    active.monthlyOnly && "opacity-50",
                    activeErrors.priceYearly && "border-danger focus:border-danger"
                  )}
                />
              </div>
              {!active.monthlyOnly && !activeErrors.priceYearly && (
                <p className="mt-1 text-[11px] text-subtle">
                  ≈ ${Math.round(active.price.yearly / 12)}/mo billed yearly
                </p>
              )}
              <FieldError message={activeErrors.priceYearly} />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-hairline bg-app/60 px-3 py-2.5 text-[11px] leading-relaxed text-subtle">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              These numbers update the price shown on <span className="font-medium text-body">/pricing</span> and every upgrade
              prompt as soon as you save. The amount actually charged at checkout is controlled separately by your Whop plan
              configuration. Keep them in sync when you reprice.
            </span>
          </div>
        </Card>

        <Card className="flex flex-col gap-5">
          <SectionHeading icon={Settings2} title="Options" />
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2.5">
              <Switch
                checked={!!active.recommended}
                onChange={() =>
                  setPlans((prev) => prev.map((p, i) => ({ ...p, recommended: i === activeIndex ? !p.recommended : false })))
                }
                label="Mark as recommended"
              />
              <span className="text-sm text-body">Recommended (&quot;Popular&quot; badge)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Switch
                checked={!!active.monthlyOnly}
                onChange={() => updateActive({ monthlyOnly: !active.monthlyOnly })}
                label="Monthly billing only"
              />
              <span className="text-sm text-body">Monthly billing only</span>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SectionHeading
              icon={ListChecks}
              title="Features"
              subtitle={`Shown as checklist bullets on the ${active.name || "plan"} card`}
            />
            <Button variant="secondary" size="sm" icon={Plus} onClick={addFeature}>
              Add feature
            </Button>
          </div>

          <FieldError message={activeErrors.features} />

          <div className="flex flex-col gap-2">
            {active.features.length === 0 && (
              <p className="rounded-lg border border-dashed border-hairline py-6 text-center text-sm text-subtle">
                No features yet. Add one above.
              </p>
            )}
            {active.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-hairline bg-app/40 p-2.5">
                <div className="flex flex-col gap-0.5 pt-1">
                  <button
                    type="button"
                    onClick={() => moveFeature(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="text-subtle hover:text-heading disabled:opacity-30"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFeature(i, 1)}
                    disabled={i === active.features.length - 1}
                    aria-label="Move down"
                    className="text-subtle hover:text-heading disabled:opacity-30"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <input
                    type="text"
                    maxLength={SHORT_TEXT_MAX}
                    value={feature.text}
                    onChange={(e) => updateFeature(i, { text: e.target.value })}
                    placeholder="Feature text"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    maxLength={SHORT_TEXT_MAX}
                    value={feature.tooltip ?? ""}
                    onChange={(e) => updateFeature(i, { tooltip: e.target.value || undefined })}
                    placeholder="Tooltip (optional)"
                    className={cn(inputClass, "text-xs")}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeFeature(i)}
                  aria-label="Remove feature"
                  className="mt-1.5 shrink-0 text-subtle hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface/95 p-3 shadow-card backdrop-blur">
          <Button
            variant="secondary"
            size="sm"
            icon={RotateCcw}
            onClick={requestReset}
            disabled={!isDirty}
            className={cn(resetConfirm && "border-danger text-danger")}
          >
            {resetConfirm ? "Confirm reset?" : "Reset all plans"}
          </Button>
          <div className="flex items-center gap-3">
            {saveError && <span className="text-xs font-medium text-danger">{saveError}</span>}
            {!saveError && hasAnyErrors && <span className="text-xs font-medium text-danger">Fix errors before saving</span>}
            {!saveError && !hasAnyErrors && !isDirty && savedAt && (
              <span className="text-xs font-medium text-success">Saved</span>
            )}
            <Button icon={Save} onClick={save} disabled={isSaving || !isDirty || hasAnyErrors}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:sticky xl:top-6 xl:self-start">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-heading">Live preview</h3>
          <Button href="/pricing" variant="text" size="sm" icon={ExternalLink} iconPosition="right" target="_blank">
            Open pricing page
          </Button>
        </div>
        <div className="w-fit">
          <Tabs
            items={[
              { id: "monthly", label: "Monthly" },
              { id: "yearly", label: "Yearly" },
            ]}
            active={frequency}
            onChange={(id) => setFrequency(id as PricingFrequency)}
          />
        </div>
        <div className="overflow-hidden rounded-2xl border border-hairline bg-[#eef0f4] shadow-card">
          <div className="flex items-center gap-1.5 border-b border-black/5 px-3.5 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2 flex-1 truncate rounded-md bg-white px-2.5 py-1 text-center text-[11px] font-medium text-slate-500">
              verlab.io/pricing
            </span>
          </div>
          <div className="bg-white p-5">
            <PricingCard plan={active} frequency={frequency} compact />
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-subtle">
          <Info className="h-3 w-3 shrink-0" />
          The marketing site always renders light, so this preview stays light too. It&apos;s showing you exactly what
          visitors see.
        </p>
      </div>
    </div>
  );
}
