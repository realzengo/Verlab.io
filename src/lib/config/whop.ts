// Whop product/plan-ID mapping and SDK client factory. Single source of truth
// for "which Whop plan maps to which credit pack / plan+period" so the
// checkout routes and the webhook handler can never drift out of sync with
// each other. Mirrors src/lib/config/polar.ts's shape -- Polar is left wired
// but unused after switching processors; see that file for the prior setup.
//
// Env vars are read lazily (inside functions, not at module scope) so that
// importing this file never throws before the routes that need it are
// actually invoked -- e.g. during `next build`'s page-data collection, which
// imports route modules to inspect their exports.
import Whop from "@whop/sdk";

export type CreditPackId = "500" | "1000" | "3000" | "10000";
export type SubscriptionPlanId = "core" | "pro" | "scale";
export type BillingPeriod = "monthly" | "yearly";

interface CreditPackConfig {
  credits: number;
  priceUsd: number;
  whopPlanId: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

// Mirrors src/components/TopUpModal.tsx's PACKS array. The client sends only
// a packId, never raw credit/price numbers -- this table is what the server
// actually trusts when granting credits.
export function getCreditPacks(): Record<CreditPackId, CreditPackConfig> {
  return {
    "500": { credits: 500, priceUsd: 8, whopPlanId: requiredEnv("WHOP_PLAN_CREDITS_500") },
    "1000": { credits: 1000, priceUsd: 15, whopPlanId: requiredEnv("WHOP_PLAN_CREDITS_1000") },
    "3000": { credits: 3000, priceUsd: 39, whopPlanId: requiredEnv("WHOP_PLAN_CREDITS_3000") },
    "10000": { credits: 10000, priceUsd: 119, whopPlanId: requiredEnv("WHOP_PLAN_CREDITS_10000") },
  };
}

interface SubscriptionProductConfig {
  whopMonthlyPlanId: string;
  whopYearlyPlanId: string | null;
  /** plan_definitions.credits_per_period for this plan (the monthly figure; yearly grants 12x). */
  monthlyCreditsPerPeriod: number;
}

// Each billing interval is its own Whop plan (attached to its own hidden
// product), the same one-plan-per-offering shape as the old Polar setup --
// keeps this table a straight product/plan-ID swap, nothing else to change.
export function getSubscriptionProducts(): Record<SubscriptionPlanId, SubscriptionProductConfig> {
  return {
    core: { whopMonthlyPlanId: requiredEnv("WHOP_PLAN_CORE_MONTHLY"), whopYearlyPlanId: null, monthlyCreditsPerPeriod: 1250 },
    pro: {
      whopMonthlyPlanId: requiredEnv("WHOP_PLAN_PRO_MONTHLY"),
      whopYearlyPlanId: requiredEnv("WHOP_PLAN_PRO_YEARLY"),
      monthlyCreditsPerPeriod: 2600,
    },
    scale: {
      whopMonthlyPlanId: requiredEnv("WHOP_PLAN_SCALE_MONTHLY"),
      whopYearlyPlanId: requiredEnv("WHOP_PLAN_SCALE_YEARLY"),
      monthlyCreditsPerPeriod: 5900,
    },
  };
}

export function getSubscriptionPlanId(planId: SubscriptionPlanId, period: BillingPeriod): string {
  const plan = getSubscriptionProducts()[planId];
  if (period === "yearly") {
    if (!plan.whopYearlyPlanId) {
      throw new Error(`Plan "${planId}" does not support yearly billing`);
    }
    return plan.whopYearlyPlanId;
  }
  return plan.whopMonthlyPlanId;
}

/** Reverse lookup used by the webhook handler: Whop plan id (payment.plan.id) -> credit pack. */
export function findCreditPackByPlanId(whopPlanId: string): { packId: CreditPackId; credits: number } | null {
  for (const [packId, pack] of Object.entries(getCreditPacks()) as [CreditPackId, CreditPackConfig][]) {
    if (pack.whopPlanId === whopPlanId) {
      return { packId, credits: pack.credits };
    }
  }
  return null;
}

/** Reverse lookup used by the webhook handler: Whop plan id (payment.plan.id / membership.plan.id) -> plan + period. */
export function findSubscriptionPlanByPlanId(
  whopPlanId: string
): { planId: SubscriptionPlanId; period: BillingPeriod; creditsPerPeriod: number } | null {
  for (const [planId, plan] of Object.entries(getSubscriptionProducts()) as [SubscriptionPlanId, SubscriptionProductConfig][]) {
    if (plan.whopMonthlyPlanId === whopPlanId) {
      return { planId, period: "monthly", creditsPerPeriod: plan.monthlyCreditsPerPeriod };
    }
    if (plan.whopYearlyPlanId === whopPlanId) {
      return { planId, period: "yearly", creditsPerPeriod: plan.monthlyCreditsPerPeriod * 12 };
    }
  }
  return null;
}

let client: Whop | undefined;

/** Constructs the Whop SDK client once from WHOP_API_KEY. */
export function getWhopClient(): Whop {
  if (!client) {
    client = new Whop({ apiKey: requiredEnv("WHOP_API_KEY") });
  }
  return client;
}

export function getWhopCompanyId(): string {
  return requiredEnv("WHOP_COMPANY_ID");
}
