"use client";

import { useState } from "react";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { PricingCard } from "@/components/pricing/PricingCard";
import { PricingFrequencyToggle } from "@/components/pricing/PricingFrequencyToggle";
import { useResetOnPageRestore } from "@/lib/hooks/useResetOnPageRestore";
import { stashPendingPurchase } from "@/lib/analytics/whop";

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
  subscriptionStatus = null,
  subscriptionPeriod = null,
}: {
  plans: PricingPlan[];
  /** Where logged-out visitors are sent instead of straight to checkout. */
  ctaHref?: string;
  /** When true, ignores ctaHref and starts a Whop checkout for the signed-in user instead. */
  authenticated?: boolean;
  /** The signed-in user's active plan id -- marks that card as current and disables its CTA. */
  currentPlanId?: string | null;
  /** Whop's status for the current plan's membership -- recolors/relabels that card's badge. */
  subscriptionStatus?: string | null;
  /** The cycle the signed-in user is actually billed on -- opens the toggle on that cycle and gates the "Current Plan" badge so it never shows next to a price they didn't agree to. */
  subscriptionPeriod?: PricingFrequency | null;
}) {
  // Opens on the subscriber's actual billing cycle so "Current Plan" never
  // shows next to a price they didn't agree to; defaults to "yearly" to
  // nudge everyone else toward the better-value plan. subscriptionPeriod is
  // server-fetched and fixed for the page's lifetime, so a lazy initializer
  // (rather than an effect) is enough to pick it up.
  const [frequency, setFrequency] = useState<PricingFrequency>(() => subscriptionPeriod ?? "yearly");
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

      stashPendingPurchase({ value: plan.price[frequency], currency: "USD", plan: plan.id, period: frequency });
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
              isCurrentPlan={plan.id === currentPlanId && frequency === (subscriptionPeriod ?? "monthly")}
              subscriptionStatus={subscriptionStatus}
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
