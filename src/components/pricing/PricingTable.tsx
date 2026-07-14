import type { PricingPlan } from "@/lib/types";
import { PricingCard } from "@/components/pricing/PricingCard";

export function PricingTable({ plans, ctaHrefFor }: { plans: PricingPlan[]; ctaHrefFor?: (plan: PricingPlan) => string }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {plans.map((plan) => (
        <PricingCard key={plan.id} plan={plan} ctaHref={ctaHrefFor?.(plan)} />
      ))}
    </div>
  );
}
