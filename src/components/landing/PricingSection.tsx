import { COMPARISON_ROWS } from "@/lib/mock-data";
import { getCachedPlanDefinitions } from "@/lib/server/admin-queries";
import { createClient } from "@/lib/supabase/server";
import { PricingSectionClient } from "@/components/landing/PricingSectionClient";

export async function PricingSection({ showComparison = true }: { showComparison?: boolean } = {}) {
  const supabase = await createClient();
  const [plans, { data: { user } }] = await Promise.all([
    getCachedPlanDefinitions(),
    supabase.auth.getUser(),
  ]);

  const profile = user
    ? (await supabase.from("profiles").select("plan, subscription_status").eq("id", user.id).single()).data
    : null;

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 pb-14 pt-24 sm:px-6 sm:pb-[90px] sm:pt-36 lg:px-8">
      <PricingSectionClient
        plans={plans}
        comparisonRows={COMPARISON_ROWS}
        authenticated={!!user}
        currentPlanId={profile?.plan ?? null}
        subscriptionStatus={profile?.subscription_status ?? null}
        showComparison={showComparison}
      />
    </section>
  );
}
