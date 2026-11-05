import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/server/admin";
import { hasNicheFinderAccess } from "@/lib/subscription-status";

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
