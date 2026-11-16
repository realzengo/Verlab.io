// Whop product/plan-ID mapping and SDK client factory. Single source of truth
// for "which Whop plan maps to which credit pack / plan+period" so the
// checkout routes and the webhook handler can never drift out of sync with
// each other.
//
// Env vars are read lazily (inside functions, not at module scope) so that
// importing this file never throws before the routes that need it are
// actually invoked -- e.g. during `next build`'s page-data collection, which
// imports route modules to inspect their exports.
import "server-only";
import Whop from "@whop/sdk";

export type CreditPackId = "500" | "1000" | "3000" | "10000";
export type SubscriptionPlanId = "core" | "pro" | "scale";
export type BillingPeriod = "monthly" | "yearly";

interface CreditPackConfig {
  credits: number;
  priceUsd: number;
  whopPlanId: string;
}

/**
 * An env var's plan id, kept only as an extra id the webhook recognises when
 * it differs from the pinned one -- so a member who bought through a stale
 * production value still gets credited, but new checkouts never sell it.
 */
function legacyFromEnv(name: string, pinned: string): string[] {
  const value = process.env[name];
  return value && value !== pinned ? [value] : [];
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
//
// Every Whop plan id below is pinned in code, not read from env: production's
// env went stale once (Core sold at $19 for weeks) and nothing noticed. Plan
// ids aren't secret. Checked against Whop's plan list on 2026-11-16.
const CREDIT_PACK_PLAN_IDS: Record<CreditPackId, string> = {
  "500": "plan_AIlDuDh9gwDZY", // $8
  "1000": "plan_9hvnT8WQbBGVq", // $15
  "3000": "plan_xt3zCMTs1jPx9", // $39
  "10000": "plan_CrM6jYEF5hKIA", // $119
};

export function getCreditPacks(): Record<CreditPackId, CreditPackConfig> {
  return {
    "500": { credits: 500, priceUsd: 8, whopPlanId: CREDIT_PACK_PLAN_IDS["500"] },
    "1000": { credits: 1000, priceUsd: 15, whopPlanId: CREDIT_PACK_PLAN_IDS["1000"] },
    "3000": { credits: 3000, priceUsd: 39, whopPlanId: CREDIT_PACK_PLAN_IDS["3000"] },
    "10000": { credits: 10000, priceUsd: 119, whopPlanId: CREDIT_PACK_PLAN_IDS["10000"] },
  };
}

/** Pack plan ids the webhook still credits: the pinned one plus a differing env value. */
function packPlanIds(packId: CreditPackId): string[] {
  return [CREDIT_PACK_PLAN_IDS[packId], ...legacyFromEnv(`WHOP_PLAN_CREDITS_${packId}`, CREDIT_PACK_PLAN_IDS[packId])];
}

interface SubscriptionProductConfig {
  whopMonthlyPlanId: string;
  whopYearlyPlanId: string | null;
  /** plan_definitions.credits_per_period for this plan (the monthly figure; yearly grants 12x). */
  monthlyCreditsPerPeriod: number;
  /**
   * Retired Whop plans for this tier. New checkouts never use them, but
   * members who bought them still renew/cancel on them, so the webhook's
   * reverse lookup must keep recognising them. Whop refuses to reprice a plan
   * that has ever sold, so a price change always means a new plan id here.
   */
  legacyPlanIds?: { monthly: string[]; yearly: string[] };
}

// Each billing interval is its own Whop plan, attached to its own hidden
// product.
export function getSubscriptionProducts(): Record<SubscriptionPlanId, SubscriptionProductConfig> {
  return {
    core: {
      // Pinned in code, not read from WHOP_PLAN_CORE_*: production's env kept
      // pointing at the retired $19/$204 plans, so checkout undercharged
      // against the $25/$228 the pricing page shows. Plan ids aren't secret.
      whopMonthlyPlanId: "plan_OaFOlspjbyFPD", // $25 / month
      whopYearlyPlanId: "plan_AXb5d4QsVacag", // $228 / year
      monthlyCreditsPerPeriod: 1250,
      legacyPlanIds: {
        // $19 and $17 monthly, before Core moved to $25.
        monthly: ["plan_G66hfOV3PuQwF", "plan_IFbGdPWeGYqeg"],
        // $204 and $153 yearly, before Core moved to $228.
        yearly: ["plan_1vxYRB4J3TfjE", "plan_FDHiLVEg2BtsU"],
      },
    },
    pro: {
      whopMonthlyPlanId: "plan_rZLm1VGnjAD6P", // $39 / month
      whopYearlyPlanId: "plan_wJXyS715t0The", // $360 / year
      monthlyCreditsPerPeriod: 2600,
      legacyPlanIds: {
        monthly: legacyFromEnv("WHOP_PLAN_PRO_MONTHLY", "plan_rZLm1VGnjAD6P"),
        yearly: legacyFromEnv("WHOP_PLAN_PRO_YEARLY", "plan_wJXyS715t0The"),
      },
    },
    scale: {
      whopMonthlyPlanId: "plan_TAc6zIzAOVINJ", // $89 / month
      whopYearlyPlanId: "plan_thkuopUXif7ND", // $792 / year
      monthlyCreditsPerPeriod: 5900,
      legacyPlanIds: {
        monthly: legacyFromEnv("WHOP_PLAN_SCALE_MONTHLY", "plan_TAc6zIzAOVINJ"),
        yearly: legacyFromEnv("WHOP_PLAN_SCALE_YEARLY", "plan_thkuopUXif7ND"),
      },
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
    if (packPlanIds(packId).includes(whopPlanId)) {
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
    if (plan.whopMonthlyPlanId === whopPlanId || plan.legacyPlanIds?.monthly.includes(whopPlanId)) {
      return { planId, period: "monthly", creditsPerPeriod: plan.monthlyCreditsPerPeriod };
    }
    if (plan.whopYearlyPlanId === whopPlanId || plan.legacyPlanIds?.yearly.includes(whopPlanId)) {
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
