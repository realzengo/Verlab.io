import { COMPARISON_ROWS } from "@/lib/mock-data";
import { getCachedPlanDefinitions } from "@/lib/server/admin-queries";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/server/subscription";
import { PricingSectionClient } from "@/components/landing/PricingSectionClient";

export async function PricingSection({ showComparison = true }: { showComparison?: boolean } = {}) {
  const supabase = await createClient();
  const [plans, { data: { user } }] = await Promise.all([
    getCachedPlanDefinitions(),
    supabase.auth.getUser(),
  ]);

  const profile = user
    ? (
        await supabase
          .from("profiles")
          .select("plan, subscription_status, subscription_period, subscription_current_period_end")
          .eq("id", user.id)
          .single()
      ).data
    : null;

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 pb-14 pt-24 sm:px-6 sm:pb-[90px] sm:pt-36 lg:px-8">
      <PricingSectionClient
        plans={plans}
        comparisonRows={COMPARISON_ROWS}
        authenticated={!!user}
        // profiles.plan defaults to "core" and keeps its last paid value
        // after a subscription lapses -- only treat a card as "Current Plan"
        // when there's an actual active subscription behind it (same check
        // the /app paywall and topup checkout use), not just a leftover
        // plan id on the row.
        currentPlanId={hasActiveSubscription(profile) ? (profile?.plan ?? null) : null}
        subscriptionStatus={profile?.subscription_status ?? null}
        subscriptionPeriod={profile?.subscription_period === "monthly" || profile?.subscription_period === "yearly" ? profile.subscription_period : null}
        showComparison={showComparison}
      />
    </section>
  );
}
