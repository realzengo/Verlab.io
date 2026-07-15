import { PRICING_PLANS, COMPARISON_ROWS } from "@/lib/mock-data";
import { PricingTable } from "@/components/pricing/PricingTable";
import { PricingComparisonTable } from "@/components/pricing/PricingComparisonTable";

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">Pricing</span>
        <h2 className="mt-3.5 text-[28px] font-semibold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]">
          Simple pricing
        </h2>
        <p className="mt-3 text-base text-body sm:mt-3.5 sm:text-[17px]">
          Pick a plan and start bending niches today.
        </p>
      </div>

      <div className="mt-8 sm:mt-10">
        <PricingTable plans={PRICING_PLANS} ctaHref="/app" />
      </div>

      <div className="mt-8 overflow-x-auto sm:mt-12">
        <PricingComparisonTable plans={PRICING_PLANS} rows={COMPARISON_ROWS} />
      </div>
    </section>
  );
}
