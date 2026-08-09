import { createClient } from "@/lib/supabase/server";
import { NicheFinder, VIDEOS_PER_PAGE } from "@/components/features/NicheFinder";
import { mapTrendingVideoRow, TRENDING_VIDEO_COLUMNS, type TrendingVideoRow } from "@/lib/server/trending-videos";
import { NICHE_ORDER } from "@/lib/niches-catalog";

export default async function NichesPage() {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: firstPageRows, error: firstPageError }, { data: nicheCategoryRows }] =
    await Promise.all([
      // First page of the "all niches" feed, fetched server-side so the page
      // isn't a client-side spinner on first paint. Every subsequent page or
      // niche selection is fetched client-side from /api/niches/[niche]/videos.
      // Fetches one row past VIDEOS_PER_PAGE so "has a next page" can be read
      // off the result shape instead of a separate COUNT(*) query.
      // Filtered to the last 30 days to match NicheFinder's default time
      // window — otherwise the SSR-skip-fetch logic on mount would treat
      // this unfiltered result as if it were already the 30d page.
      supabase
        .from("trending_videos")
        .select(TRENDING_VIDEO_COLUMNS)
        .gte("posted_at", thirtyDaysAgo)
        .order("view_count", { ascending: false })
        .range(0, VIDEOS_PER_PAGE),
      // Lightweight aggregate for the sidebar's per-niche counts — only the
      // category column, not full rows, across the whole cached pool.
      supabase.from("trending_videos").select("niche_category").limit(5000),
    ]);

  if (firstPageError) {
    console.error("Failed to load initial trending videos page:", firstPageError);
  }

  const firstPageAll = ((firstPageRows as TrendingVideoRow[]) ?? []).map(mapTrendingVideoRow);
  const initialHasMore = firstPageAll.length > VIDEOS_PER_PAGE;
  const initialVideos = firstPageAll.slice(0, VIDEOS_PER_PAGE);

  const nicheCounts: Record<string, number> = {};
  for (const row of (nicheCategoryRows as { niche_category: string | null }[]) ?? []) {
    if (!row.niche_category) continue;
    nicheCounts[row.niche_category] = (nicheCounts[row.niche_category] ?? 0) + 1;
  }
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
