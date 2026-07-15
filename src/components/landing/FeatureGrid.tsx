import { FEATURE_GRID_ITEMS } from "@/lib/mock-data";
import { FeatureCard } from "@/components/landing/FeatureCard";

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">Everything in one place</span>
        <h2 className="mt-3.5 text-[28px] font-semibold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]">
          Everything you need to bend a niche
        </h2>
        <p className="mt-3 text-base text-body sm:mt-3.5 sm:text-[17px]">
          From finding the niche to filming the script — one toolkit, start to finish.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {FEATURE_GRID_ITEMS.map((item) => (
          <FeatureCard key={item.title} item={item} />
        ))}
      </div>
    </section>
  );
}
