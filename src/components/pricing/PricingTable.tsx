"use client";

import { useState } from "react";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { PricingCard } from "@/components/pricing/PricingCard";
import { PricingFrequencyToggle } from "@/components/pricing/PricingFrequencyToggle";

export function PricingTable({ plans, ctaHref }: { plans: PricingPlan[]; ctaHref?: string }) {
  const [frequency, setFrequency] = useState<PricingFrequency>("monthly");

  return (
    <div className="flex flex-col items-center gap-8">
      <PricingFrequencyToggle frequency={frequency} onChange={setFrequency} />
      <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        {plans.map((plan) => (
          <PricingCard key={plan.id} plan={plan} frequency={frequency} ctaHref={ctaHref} />
        ))}
      </div>
    </div>
  );
}
