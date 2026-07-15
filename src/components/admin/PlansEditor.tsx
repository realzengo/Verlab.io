"use client";

import { useState } from "react";
import { GripVertical, Plus, RotateCcw, Save, Star, Trash2 } from "lucide-react";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { PricingCard } from "@/components/pricing/PricingCard";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-heading outline-none placeholder:text-subtle focus:border-primary";
const labelClass = "mb-1.5 block text-xs font-medium text-body";

function clonePlans(plans: PricingPlan[]): PricingPlan[] {
  return plans.map((p) => ({ ...p, price: { ...p.price }, features: p.features.map((f) => ({ ...f })) }));
}

export function PlansEditor({ initialPlans }: { initialPlans: PricingPlan[] }) {
  const [plans, setPlans] = useState<PricingPlan[]>(() => clonePlans(initialPlans));
  const [activeId, setActiveId] = useState(initialPlans[0].id);
  const [frequency, setFrequency] = useState<PricingFrequency>("monthly");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const activeIndex = plans.findIndex((p) => p.id === activeId);
  const active = plans[activeIndex];

  function updateActive(patch: Partial<PricingPlan>) {
    setPlans((prev) => prev.map((p, i) => (i === activeIndex ? { ...p, ...patch } : p)));
    setSavedAt(null);
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

  function resetAll() {
    setPlans(clonePlans(initialPlans));
    setSavedAt(null);
  }

  function save() {
    // Mock-only: persists to local state for this session (no backend wired up yet).
    setSavedAt(Date.now());
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-6">
        <Card padded={false} className="p-2">
          <div className="flex flex-wrap gap-1.5">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveId(p.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  p.id === activeId ? "bg-accent text-primary" : "text-body hover:bg-app hover:text-heading"
                )}
              >
                {p.name || "Untitled"}
                {p.recommended && <Star className="h-3.5 w-3.5 fill-current text-primary" />}
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Plan name</label>
              <input
                type="text"
                value={active.name}
                onChange={(e) => updateActive({ name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Call to action</label>
              <input
                type="text"
                value={active.cta}
                onChange={(e) => updateActive({ cta: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <input
              type="text"
              value={active.info}
              onChange={(e) => updateActive({ info: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Monthly price (USD)</label>
              <input
                type="number"
                min={0}
                value={active.price.monthly}
                onChange={(e) => updateActive({ price: { ...active.price, monthly: Number(e.target.value) || 0 } })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Yearly price, billed annually (USD)</label>
              <input
                type="number"
                min={0}
                value={active.price.yearly}
                disabled={active.monthlyOnly}
                onChange={(e) => updateActive({ price: { ...active.price, yearly: Number(e.target.value) || 0 } })}
                className={cn(inputClass, active.monthlyOnly && "opacity-50")}
              />
              {!active.monthlyOnly && (
                <p className="mt-1 text-[11px] text-subtle">
                  ≈ ${Math.round(active.price.yearly / 12)}/mo billed yearly
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Limits note (optional, shown under the price)</label>
            <input
              type="text"
              value={active.limits ?? ""}
              onChange={(e) => updateActive({ limits: e.target.value || undefined })}
              placeholder="e.g. Up to 5 team seats"
              className={inputClass}
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 border-t border-hairline pt-4">
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

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-heading">Features</h3>
              <p className="text-xs text-body">Shown as checklist bullets on the {active.name || "plan"} card</p>
            </div>
            <Button variant="secondary" size="sm" icon={Plus} onClick={addFeature}>
              Add feature
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {active.features.length === 0 && (
              <p className="rounded-lg border border-dashed border-hairline py-6 text-center text-sm text-subtle">
                No features yet — add one above.
              </p>
            )}
            {active.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-hairline bg-app/40 p-2.5">
                <div className="flex flex-col pt-1.5">
                  <button
                    type="button"
                    onClick={() => moveFeature(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="text-subtle hover:text-heading disabled:opacity-30"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <input
                    type="text"
                    value={feature.text}
                    onChange={(e) => updateFeature(i, { text: e.target.value })}
                    placeholder="Feature text"
                    className={inputClass}
                  />
                  <input
                    type="text"
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

        <div className="flex items-center justify-between">
          <Button variant="secondary" icon={RotateCcw} onClick={resetAll}>
            Reset all plans
          </Button>
          <div className="flex items-center gap-3">
            {savedAt && <span className="text-xs text-subtle">Saved for this session</span>}
            <Button icon={Save} onClick={save}>
              Save changes
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-heading">Live preview</h3>
          <Badge>Preview</Badge>
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
        <PricingCard plan={active} frequency={frequency} />
      </div>
    </div>
  );
}
