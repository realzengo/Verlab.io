import type { SupabaseClient } from "@supabase/supabase-js";

// Shared definition of "has an active subscription" -- used by proxy.ts (the
// /app paywall gate) and any server route that must only act for subscribers
// (e.g. credit top-up checkout, which requires an active plan to purchase
// against). Keeping one definition means a billing-status edge case (grace
// windows, cancel-but-still-in-period) can't drift between call sites.

// How long a past_due subscriber keeps access after their billing period
// ended, before Whop's payment retries are given up on. Matches Whop's own
// dunning window (a handful of retry attempts over a few days).
export const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

// A subscription the user has scheduled to cancel ("canceling", Whop's
// vocabulary; "canceled" kept for rows written before the Polar->Whop
// migration) still owes access through the period already paid for -- only
// lapsed once subscription_current_period_end has passed.
export const CANCELED_STATUSES = new Set(["canceled", "canceling"]);

export interface SubscriptionProfile {
  subscription_status: string | null;
  subscription_current_period_end: string | null;
}

export function hasActiveSubscription(profile: SubscriptionProfile | null): boolean {
  const periodEndMs = profile?.subscription_current_period_end
    ? new Date(profile.subscription_current_period_end).getTime()
    : null;

  const isWithinPastDueGrace =
    profile?.subscription_status === "past_due" && periodEndMs !== null && Date.now() < periodEndMs + PAST_DUE_GRACE_MS;

  const isCanceledButStillInPeriod =
    !!profile?.subscription_status &&
    CANCELED_STATUSES.has(profile.subscription_status) &&
    periodEndMs !== null &&
    Date.now() < periodEndMs;

  return (
    profile?.subscription_status === "active" ||
    profile?.subscription_status === "trialing" ||
    isWithinPastDueGrace ||
    isCanceledButStillInPeriod
  );
}

export interface PlanProfile extends SubscriptionProfile {
  plan: string | null;
}

// Niche Finder (trending-niche discovery, /niches) is Pro/Scale only -- see
// the Core plan's feature list on the pricing page. Gates on both an active
// subscription and the plan tier, reusing hasActiveSubscription above so the
// two checks can't drift apart on billing-status edge cases.
export function hasNicheFinderAccess(profile: PlanProfile | null): boolean {
  return hasActiveSubscription(profile) && (profile?.plan === "pro" || profile?.plan === "scale");
}

// Shared fetch+check for hasNicheFinderAccess -- every Niche Finder API
// route and the /niches page itself call this, so the profile-column list
// and access rule can't drift between call sites the way six inline copies
// of the same query would.
export async function requireNicheFinderAccess(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_status, subscription_current_period_end")
    .eq("id", userId)
    .single();
  return hasNicheFinderAccess(profile);
}
