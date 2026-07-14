import { NICHES } from "@/lib/mock-data";
import { NicheCard } from "@/components/features/NicheCard";
import { NicheFinder } from "@/components/features/NicheFinder";

export default function NichesPage() {
  return (
    <div className="flex flex-col gap-10 pt-2">
      <NicheFinder />

      <div id="all-niches" className="flex flex-col gap-6 scroll-mt-6">
        <div>
          <h2 className="text-lg font-semibold text-heading">All niches</h2>
          <p className="mt-1 text-sm text-body">
            Trending faceless niches ranked by momentum score. Pick one to bend into your own topic.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {NICHES.map((niche) => (
            <NicheCard key={niche.id} niche={niche} bendHref="/app/bend" />
          ))}
        </div>
      </div>
    </div>
  );
}
