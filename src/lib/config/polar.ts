// Polar.sh product-ID mapping and SDK client factory. Single source of truth
// for "which Polar product maps to which credit pack / plan+period" so the
// checkout routes and the webhook handler can never drift out of sync with
// each other, and so a sandbox -> production cutover is a pure env-var swap.
//
// Env vars are read lazily (inside functions, not at module scope) so that
// importing this file never throws before the routes that need it are
// actually invoked -- e.g. during `next build`'s page-data collection, which
// imports route modules to inspect their exports.
import { Polar } from "@polar-sh/sdk";

export type CreditPackId = "500" | "1000" | "3000" | "10000";
export type SubscriptionPlanId = "core" | "pro" | "scale";
export type BillingPeriod = "monthly" | "yearly";

interface CreditPackConfig {
  credits: number;
  priceUsd: number;
  polarProductId: string;
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
    "500": { credits: 500, priceUsd: 8, polarProductId: requiredEnv("POLAR_PRODUCT_CREDITS_500") },
    "1000": { credits: 1000, priceUsd: 15, polarProductId: requiredEnv("POLAR_PRODUCT_CREDITS_1000") },
    "3000": { credits: 3000, priceUsd: 39, polarProductId: requiredEnv("POLAR_PRODUCT_CREDITS_3000") },
    "10000": { credits: 10000, priceUsd: 119, polarProductId: requiredEnv("POLAR_PRODUCT_CREDITS_10000") },
  };
}

interface SubscriptionProductConfig {
  polarMonthlyProductId: string;
  polarYearlyProductId: string | null;
  /** plan_definitions.credits_per_period for this plan (the monthly figure; yearly grants 12x). */
  monthlyCreditsPerPeriod: number;
}

// A Polar checkout session picks one product, not one price within a
// multi-price product -- so Pro/Scale each need a separate product per
// billing interval rather than one product with two prices.
export function getSubscriptionProducts(): Record<SubscriptionPlanId, SubscriptionProductConfig> {
  return {
    core: { polarMonthlyProductId: requiredEnv("POLAR_PRODUCT_CORE_MONTHLY"), polarYearlyProductId: null, monthlyCreditsPerPeriod: 1250 },
    pro: {
      polarMonthlyProductId: requiredEnv("POLAR_PRODUCT_PRO_MONTHLY"),
      polarYearlyProductId: requiredEnv("POLAR_PRODUCT_PRO_YEARLY"),
      monthlyCreditsPerPeriod: 2600,
    },
    scale: {
      polarMonthlyProductId: requiredEnv("POLAR_PRODUCT_SCALE_MONTHLY"),
      polarYearlyProductId: requiredEnv("POLAR_PRODUCT_SCALE_YEARLY"),
      monthlyCreditsPerPeriod: 5900,
    },
  };
}

export function getSubscriptionProductId(planId: SubscriptionPlanId, period: BillingPeriod): string {
  const plan = getSubscriptionProducts()[planId];
  if (period === "yearly") {
    if (!plan.polarYearlyProductId) {
      throw new Error(`Plan "${planId}" does not support yearly billing`);
    }
    return plan.polarYearlyProductId;
  }
  return plan.polarMonthlyProductId;
}

/** Reverse lookup used by the webhook handler: Polar product id -> credit pack. */
export function findCreditPackByProductId(polarProductId: string): { packId: CreditPackId; credits: number } | null {
  for (const [packId, pack] of Object.entries(getCreditPacks()) as [CreditPackId, CreditPackConfig][]) {
    if (pack.polarProductId === polarProductId) {
      return { packId, credits: pack.credits };
    }
  }
  return null;
}

/** Reverse lookup used by the webhook handler: Polar product id -> plan + period. */
export function findSubscriptionPlanByProductId(
  polarProductId: string
): { planId: SubscriptionPlanId; period: BillingPeriod; creditsPerPeriod: number } | null {
  for (const [planId, plan] of Object.entries(getSubscriptionProducts()) as [SubscriptionPlanId, SubscriptionProductConfig][]) {
    if (plan.polarMonthlyProductId === polarProductId) {
      return { planId, period: "monthly", creditsPerPeriod: plan.monthlyCreditsPerPeriod };
    }
    if (plan.polarYearlyProductId === polarProductId) {
      return { planId, period: "yearly", creditsPerPeriod: plan.monthlyCreditsPerPeriod * 12 };
    }
  }
  return null;
}

let client: Polar | undefined;

/** Constructs the Polar SDK client once from POLAR_ACCESS_TOKEN/POLAR_SERVER, mirroring createAdminClient()'s pattern. */
export function getPolarClient(): Polar {
  if (!client) {
    const server = process.env.POLAR_SERVER === "production" ? "production" : "sandbox";
    client = new Polar({ accessToken: requiredEnv("POLAR_ACCESS_TOKEN"), server });
  }
  return client;
}
