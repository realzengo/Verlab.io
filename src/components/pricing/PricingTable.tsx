"use client";

import { useState } from "react";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { PricingCard } from "@/components/pricing/PricingCard";
import { PricingFrequencyToggle } from "@/components/pricing/PricingFrequencyToggle";

export function PricingTable({
  plans,
  ctaHref,
  authenticated,
}: {
  plans: PricingPlan[];
  /** Where logged-out visitors are sent instead of straight to checkout. */
  ctaHref?: string;
  /** When true, ignores ctaHref and starts a Polar checkout for the signed-in user instead. */
  authenticated?: boolean;
}) {
  const [frequency, setFrequency] = useState<PricingFrequency>("monthly");
  const [checkingOutPlanId, setCheckingOutPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col items-center gap-8">
      <PricingFrequencyToggle frequency={frequency} onChange={setFrequency} />
      <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        {plans.map((plan) =>
          authenticated ? (
            <PricingCard
              key={plan.id}
              plan={{ ...plan, cta: checkingOutPlanId === plan.id ? "Starting checkout…" : plan.cta }}
              frequency={frequency}
              onSelect={handleSelect}
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
