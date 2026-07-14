import { FEATURE_GRID_ITEMS } from "@/lib/mock-data";
import { FeatureCard } from "@/components/landing/FeatureCard";

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-2xl font-semibold text-heading sm:text-3xl">Everything you need to bend a niche</h2>
        <p className="mt-3 text-sm text-body sm:text-base">
          From finding the niche to filming the script — one toolkit, start to finish.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_GRID_ITEMS.map((item) => (
          <FeatureCard key={item.title} item={item} />
        ))}
      </div>
    </section>
  );
}
