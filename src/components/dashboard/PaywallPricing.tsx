"use client";

import { useEffect, useState } from "react";
import { PricingCard } from "@/components/pricing/PricingCard";
import { PricingFrequencyToggle } from "@/components/pricing/PricingFrequencyToggle";
import { createClient } from "@/lib/supabase/client";
import { PRICING_PLANS } from "@/lib/mock/pricing";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { useResetOnPageRestore } from "@/lib/hooks/useResetOnPageRestore";

// Mirrors planRowToPricingPlan in UpgradeModal.tsx -- kept in sync there since
// it can't be shared without pulling the service-role client into a bundle.
// PLAN_DEFINITION_SELECT below mirrors admin-queries.ts's column list too --
// the table also has `updated_at`, which nothing here renders.
const PLAN_DEFINITION_SELECT = "id, name, info, price_monthly, price_yearly, recommended, monthly_only, cta, features, limits, sort_order";

interface PlanDefinitionRow {
  id: string;
  name: string;
  info: string;
  price_monthly: number;
  price_yearly: number;
  recommended: boolean;
  monthly_only: boolean;
  cta: string;
  features: { text: string; tooltip?: string }[];
  limits: string | null;
}

function planRowToPricingPlan(row: PlanDefinitionRow): PricingPlan {
  return {
    id: row.id as PricingPlan["id"],
    name: row.name,
    info: row.info,
    price: { monthly: row.price_monthly, yearly: row.price_yearly },
    recommended: row.recommended || undefined,
    monthlyOnly: row.monthly_only || undefined,
    cta: row.cta,
    features: row.features,
    limits: row.limits ?? undefined,
  };
}

function maxYearlyPercentOff(plans: PricingPlan[]): number {
  return plans.reduce((max, plan) => {
    if (plan.monthlyOnly || plan.price.monthly === 0) return max;
    const percentOff = Math.round(((plan.price.monthly * 12 - plan.price.yearly) / (plan.price.monthly * 12)) * 100);
    return Math.max(max, percentOff);
  }, 0);
}

/**
 * Takes over the main content area (sidebar and top bar stay live) for a
 * signed-in user with no active subscription and no spendable credits --
 * see the x-paywalled header set in proxy.ts. Nothing here is blurred or
 * inert: the user can still browse the sidebar, check settings, or log out
 * while picking a plan.
 */
export function PaywallPricing({ hasNeverPaid }: { hasNeverPaid: boolean }) {
  const [plans, setPlans] = useState<PricingPlan[]>(PRICING_PLANS);
  const [frequency, setFrequency] = useState<PricingFrequency>("yearly");
  const [checkingOutPlanId, setCheckingOutPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useResetOnPageRestore(() => setCheckingOutPlanId(null));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("plan_definitions").select(PLAN_DEFINITION_SELECT).order("sort_order");
      if (!cancelled && data && data.length > 0) {
        setPlans((data as PlanDefinitionRow[]).map(planRowToPricingPlan));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSelect(plan: PricingPlan) {
    setError(null);
    setCheckingOutPlanId(plan.id);
    try {
      const res = await fetch("/api/checkout/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, period: frequency }),
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
    <div className="mx-auto flex max-w-6xl flex-col items-center pb-8 pt-4 sm:pt-10">
      {hasNeverPaid && (
        <span className="mb-7 inline-flex -skew-x-12 items-center justify-center rounded-md bg-[radial-gradient(circle_at_30%_30%,#6d93ff,#335cff)] px-3.5 py-1.5">
          <span className="inline-block skew-x-12 text-center text-sm font-extrabold italic uppercase tracking-wide text-white">
            Powerful Tools. Predictable Prices.
          </span>
        </span>
      )}
      <h1 className="max-w-2xl text-center text-3xl font-bold tracking-tight text-heading sm:text-4xl">
        {hasNeverPaid ? "You Need a Plan to Go Viral" : "Pick up where you left off"}
      </h1>
      <p className="mt-3 max-w-lg text-center text-sm text-body sm:text-base">
        {hasNeverPaid
          ? "From your first upload to millions of views, we've got you covered. Cancel anytime, no questions asked."
          : "Your subscription has ended -- resubscribe to get back into your dashboard."}
      </p>

      <div className="mt-8">
        <PricingFrequencyToggle frequency={frequency} onChange={setFrequency} savePercent={savePercent || undefined} />
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="grid w-full grid-cols-1 items-start gap-6 sm:grid-cols-3 sm:gap-8">
        {plans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={{ ...plan, cta: checkingOutPlanId === plan.id ? "Starting checkout…" : plan.cta }}
            frequency={frequency}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
