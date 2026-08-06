import { COMPARISON_ROWS } from "@/lib/mock-data";
import { getPlanDefinitions } from "@/lib/server/admin-queries";
import { createClient } from "@/lib/supabase/server";
import { PricingSectionClient } from "@/components/landing/PricingSectionClient";

export async function PricingSection() {
  const supabase = await createClient();
  const [plans, { data: { user } }] = await Promise.all([
    getPlanDefinitions(supabase),
    supabase.auth.getUser(),
  ]);

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 pb-14 pt-28 sm:px-6 sm:pb-[90px] sm:pt-40 lg:px-8">
      <PricingSectionClient plans={plans} comparisonRows={COMPARISON_ROWS} authenticated={!!user} />
    </section>
  );
}
