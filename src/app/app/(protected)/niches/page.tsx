import { NicheFinder, VIDEOS_PER_PAGE } from "@/components/features/NicheFinder";
import { NicheFinderLocked } from "@/components/features/NicheFinderLocked";
import { getCachedInitialNicheFeed, getCachedNicheCounts, mapTrendingVideoRow } from "@/lib/server/trending-videos";
import { NICHE_ORDER } from "@/lib/niches-catalog";
import { createClient } from "@/lib/supabase/server";
import { requireNicheFinderAccess } from "@/lib/server/subscription";

export default async function NichesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await requireNicheFinderAccess(supabase, user.id))) {
    return (
      <div className="flex flex-col gap-6 sm:gap-10">
        <NicheFinderLocked />
      </div>
    );
  }

  // Both cached (see trending-videos.ts) -- identical query, same result,
  // for every visitor to this page until the next scrape lands, so this no
  // longer re-runs the "all niches" feed query and the 5000-row category
  // scan on literally every page view.
  const [{ rows: firstPageRows, hasMore: initialHasMore }, nicheCounts] = await Promise.all([
    // First page of the "all niches" feed, fetched server-side so the page
    // isn't a client-side spinner on first paint. Every subsequent page or
    // niche selection is fetched client-side from /api/niches/[niche]/videos.
    getCachedInitialNicheFeed(VIDEOS_PER_PAGE),
    // Lightweight aggregate for the sidebar's per-niche counts — only the
    // category column, not full rows, across the whole cached pool.
    getCachedNicheCounts(),
  ]);

  const initialVideos = firstPageRows.map(mapTrendingVideoRow);

  // Every niche is listed regardless of whether it has cached videos yet —
  // picking an empty one just triggers the on-demand scrape in
  // /api/niches/[niche]/videos (see the "Fetching fresh ... videos" state in
  // NicheFinder), rather than hiding niches until something else happens to
  // have warmed their cache first.
  const availableNiches: string[] = [...NICHE_ORDER];

  return (
    <div className="flex flex-col gap-6 sm:gap-10">
      <NicheFinder
        initialVideos={initialVideos}
        initialHasMore={initialHasMore}
        nicheCounts={nicheCounts}
        availableNiches={availableNiches}
      />
    </div>
  );
}
