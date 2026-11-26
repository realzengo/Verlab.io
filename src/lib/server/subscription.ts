import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/server/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasActiveSubscription, hasNicheFinderAccess } from "@/lib/subscription-status";

// The pure plan-status checks (hasActiveSubscription, hasNicheFinderAccess)
// live in src/lib/subscription-status.ts so client components can share them
// without pulling this module -- and ADMIN_EMAILS via isAdminEmail -- into the
// browser bundle.

// Shared fetch+check for hasNicheFinderAccess -- every Niche Finder API
// route and the /niches page itself call this, so the profile-column list
// and access rule can't drift between call sites the way six inline copies
// of the same query would. Admins (ADMIN_EMAILS) always pass, subscription
// or not.
export async function requireNicheFinderAccess(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<boolean> {
  if (isAdminEmail(user.email)) return true;
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_status, subscription_current_period_end")
    .eq("id", user.id)
    .single();
  return hasNicheFinderAccess(profile);
}

// ── Paid-only gate ──────────────────────────────────────────────────────
// Verlab has no free tier: every tool needs an active paid plan. A credit
// balance on its own (a promo code, an admin grant, credits left over after
// a subscription lapsed) does NOT unlock tools -- it waits in the balance
// until the account has a plan again. The /app paywall in src/proxy.ts uses
// the same rule for pages; this is the enforcement for API routes and MCP,
// which the proxy never gates.

export const PLAN_REQUIRED_MESSAGE = "You need an active Verlab plan to use this tool. Choose one at https://verlab.io/pricing";

/**
 * Whether this user may run tools right now. Admins (ADMIN_EMAILS) always
 * may. Callers that only have an id (MCP) can leave `email` out: it's looked
 * up only when the plan check fails, so the common path stays one query.
 */
export async function hasPaidAccess(user: { id: string; email?: string | null }): Promise<boolean> {
  if (isAdminEmail(user.email)) return true;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("subscription_status, subscription_current_period_end")
    .eq("id", user.id)
    .maybeSingle();
  if (hasActiveSubscription(profile)) return true;
  if (user.email !== undefined) return false;
  const { data } = await admin.auth.admin.getUserById(user.id);
  return isAdminEmail(data.user?.email);
}

/**
 * For tool API routes, right after the 401 check:
 *   const planRequired = await requirePaidPlan(user);
 *   if (planRequired) return planRequired;
 * Returns null when the user may proceed, or a 402 response to send back.
 */
export async function requirePaidPlan(user: { id: string; email?: string | null }): Promise<NextResponse | null> {
  if (await hasPaidAccess(user)) return null;
  return NextResponse.json({ error: PLAN_REQUIRED_MESSAGE, code: "plan_required" }, { status: 402 });
}
