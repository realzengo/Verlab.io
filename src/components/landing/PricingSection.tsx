import { PRICING_PLANS, COMPARISON_ROWS } from "@/lib/mock-data";
import { PricingTable } from "@/components/pricing/PricingTable";
import { PricingComparisonTable } from "@/components/pricing/PricingComparisonTable";

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-[90px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">Pricing</span>
        <h2 className="mt-3.5 text-[32px] font-semibold leading-[1.05] tracking-[-1px] text-slate sm:text-[45px]">
          Simple pricing
        </h2>
        <p className="mt-3.5 text-[17px] text-body">
          Start free with transcripts. Upgrade when you&rsquo;re ready to bend.
        </p>
      </div>

      <div className="mt-10">
        <PricingTable plans={PRICING_PLANS} ctaHrefFor={() => "/app"} />
      </div>

      <div className="mt-12 overflow-x-auto">
        <PricingComparisonTable plans={PRICING_PLANS} rows={COMPARISON_ROWS} />
      </div>
    </section>
  );
}
