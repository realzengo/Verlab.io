"use client";

import { useState } from "react";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { PricingCard } from "@/components/pricing/PricingCard";
import { PricingFrequencyToggle } from "@/components/pricing/PricingFrequencyToggle";
import { useResetOnPageRestore } from "@/lib/hooks/useResetOnPageRestore";

function maxYearlyPercentOff(plans: PricingPlan[]): number {
  return plans.reduce((max, plan) => {
    if (plan.monthlyOnly || plan.price.monthly === 0) return max;
    const percentOff = Math.round(((plan.price.monthly * 12 - plan.price.yearly) / (plan.price.monthly * 12)) * 100);
    return Math.max(max, percentOff);
  }, 0);
}

export function PricingTable({
  plans,
  ctaHref,
  authenticated,
  currentPlanId = null,
}: {
  plans: PricingPlan[];
  /** Where logged-out visitors are sent instead of straight to checkout. */
  ctaHref?: string;
  /** When true, ignores ctaHref and starts a Whop checkout for the signed-in user instead. */
  authenticated?: boolean;
  /** The signed-in user's active plan id -- marks that card as current and disables its CTA. */
  currentPlanId?: string | null;
}) {
  const [frequency, setFrequency] = useState<PricingFrequency>("yearly");
  const [checkingOutPlanId, setCheckingOutPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useResetOnPageRestore(() => setCheckingOutPlanId(null));

  async function handleSelect(plan: PricingPlan) {
    setError(null);
    setCheckingOutPlanId(plan.id);
    try {
      const res = await fetch("/api/checkout/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, period: frequency === "yearly" ? "yearly" : "monthly" }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout");
        setCheckingOutPlanId(null);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Could not start checkout. Please try again.");
      setCheckingOutPlanId(null);
    }
  }

  const savePercent = maxYearlyPercentOff(plans);

  return (
    <div className="flex flex-col items-center">
      <PricingFrequencyToggle frequency={frequency} onChange={setFrequency} savePercent={savePercent || undefined} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-start">
        {plans.map((plan) =>
          authenticated ? (
            <PricingCard
              key={plan.id}
              plan={{ ...plan, cta: checkingOutPlanId === plan.id ? "Starting checkout…" : plan.cta }}
              frequency={frequency}
              onSelect={handleSelect}
              isCurrentPlan={plan.id === currentPlanId}
            />
          ) : (
            <PricingCard key={plan.id} plan={plan} frequency={frequency} ctaHref={ctaHref} />
          )
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
