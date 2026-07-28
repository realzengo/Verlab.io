import { COMPARISON_ROWS } from "@/lib/mock-data";
import { getPlanDefinitions } from "@/lib/server/admin-queries";
import { createClient } from "@/lib/supabase/server";
import { PricingTable } from "@/components/pricing/PricingTable";
import { PricingComparisonTable } from "@/components/pricing/PricingComparisonTable";

export async function PricingSection() {
  const supabase = await createClient();
  const [plans, { data: { user } }] = await Promise.all([
    getPlanDefinitions(supabase),
    supabase.auth.getUser(),
  ]);

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 pb-14 pt-28 sm:px-6 sm:pb-[90px] sm:pt-40 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">Pricing</span>
        <h2 className="mt-3.5 text-[28px] font-semibold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]">
          Pricing that pays for
          <br />
          <span className="text-primary">itself in 24 hours.</span>
        </h2>
        <p className="mt-3 text-base text-body sm:mt-3.5 sm:text-[17px]">
          Reverse-engineer viral videos into your own scripts.
        </p>
      </div>

      <div className="mt-8 sm:mt-10">
        <PricingTable plans={plans} ctaHref="/app" authenticated={!!user} />
      </div>

      <div className="mt-8 overflow-x-auto sm:mt-12">
        <PricingComparisonTable plans={plans} rows={COMPARISON_ROWS} />
      </div>
    </section>
  );
}
