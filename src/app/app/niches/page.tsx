import { createClient } from "@/lib/supabase/server";
import { NicheFinder, VIDEOS_PER_PAGE } from "@/components/features/NicheFinder";
import { mapTrendingVideoRow, TRENDING_VIDEO_COLUMNS, type TrendingVideoRow } from "@/lib/server/trending-videos";
import { NICHE_ORDER } from "@/lib/niches-catalog";

export default async function NichesPage() {
  const supabase = await createClient();
  const [{ data: firstPageRows }, { data: nicheCategoryRows }] =
    await Promise.all([
      // First page of the "all niches" feed, fetched server-side so the page
      // isn't a client-side spinner on first paint. Every subsequent page or
      // niche selection is fetched client-side from /api/niches/[niche]/videos.
      // Fetches one row past VIDEOS_PER_PAGE so "has a next page" can be read
      // off the result shape instead of a separate COUNT(*) query.
      supabase
        .from("trending_videos")
        .select(TRENDING_VIDEO_COLUMNS)
        .order("view_count", { ascending: false })
        .range(0, VIDEOS_PER_PAGE),
      // Lightweight aggregate for the sidebar's per-niche counts — only the
      // category column, not full rows, across the whole cached pool.
      supabase.from("trending_videos").select("niche_category").limit(5000),
    ]);

  const firstPageAll = ((firstPageRows as TrendingVideoRow[]) ?? []).map(mapTrendingVideoRow);
  const initialHasMore = firstPageAll.length > VIDEOS_PER_PAGE;
  const initialVideos = firstPageAll.slice(0, VIDEOS_PER_PAGE);

  const nicheCounts: Record<string, number> = {};
  for (const row of (nicheCategoryRows as { niche_category: string | null }[]) ?? []) {
    if (!row.niche_category) continue;
    nicheCounts[row.niche_category] = (nicheCounts[row.niche_category] ?? 0) + 1;
  }
  const availableNiches = NICHE_ORDER.filter((niche) => (nicheCounts[niche] ?? 0) > 0);

  return (
    <div className="mt-6 flex flex-col gap-6 sm:mt-16 sm:gap-10">
      <NicheFinder
        initialVideos={initialVideos}
        initialHasMore={initialHasMore}
        nicheCounts={nicheCounts}
        availableNiches={availableNiches}
      />
    </div>
  );
}
