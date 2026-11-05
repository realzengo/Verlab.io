import type { PricingPlan } from "@/lib/types";

/**
 * Client-safe fetch of the live, admin-editable plans from GET /api/plans.
 * Returns null on any failure so callers keep their PRICING_PLANS fallback.
 */
export async function fetchPricingPlans(): Promise<PricingPlan[] | null> {
  try {
    const res = await fetch("/api/plans");
    if (!res.ok) return null;
    const { plans } = (await res.json()) as { plans: PricingPlan[] };
    return plans.length > 0 ? plans : null;
  } catch {
    return null;
  }
}
