import type { SupabaseClient } from "@supabase/supabase-js";
import { GLOBAL_REGION, refreshNicheVideoCache, type VideoPlatform } from "@/lib/server/niche-video-refresh";
import { getCachedNicheCounts } from "@/lib/server/trending-videos";
import { NICHE_ORDER, type NicheName } from "@/lib/niches-catalog";

// Deeper per-niche targets than the routine crons use (TikTok's full-catalog
// refresh effectively targets ~100/hashtag; the YouTube rotation targets 60).
// This route exists specifically to fast-forward a cold/empty table, not to
// run continuously -- see the pagination caps in sociavault-client.ts
// (MAX_PAGES_PER_HASHTAG) and youtube-client.ts (MAX_SEARCH_PAGES), which
// both already page as deep as needed to satisfy whatever target is passed
// in here.
const BACKFILL_TARGET: Record<VideoPlatform, number> = {
  tiktok: 400,
  youtube: 200,
};

// How many niches a single invocation processes. Bounded well under the
// route's maxDuration even with both platforms' deeper pagination above --
// hit the route repeatedly (it's idempotent and self-prioritizing, see
// rankColdestNiches below) to walk the full catalog rather than trying to
// do it in one shot.
export const DEFAULT_NICHES_PER_TICK = 6;
export const MAX_NICHES_PER_TICK = 12;

// Bounds how many niches are scraped concurrently within a tick -- each one
// fans out to a live SociaVault/YouTube call plus a chunked batch upsert, so
// this is what actually caps concurrent outbound requests and pooled DB
// connections for the tick as a whole, on top of batchUpsertTrendingVideos's
// own per-niche chunk concurrency.
const NICHE_CONCURRENCY = 3;

export interface BackfillTickResult {
  niche: NicheName;
  platform: VideoPlatform;
  refreshed: boolean;
}

/**
 * Ranks every catalog niche by how few cached rows it currently has (both
 * platforms combined) -- the emptiest niches are the ones actually causing
 * the "table is practically empty" symptom, so they're backfilled first.
 * A niche with zero rows sorts before one with a handful, which sorts before
 * an already-warm one.
 */
async function rankColdestNiches(take: number): Promise<NicheName[]> {
  const counts = await getCachedNicheCounts();
  return [...NICHE_ORDER].sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0)).slice(0, take) as NicheName[];
}

/**
 * Runs one backfill tick: picks the `nichesPerTick` coldest niches and, for
 * each, refreshes both TikTok and YouTube at backfill depth (deeper than the
 * routine crons pull). Reuses refreshNicheVideoCache for the actual
 * scrape+upsert+lock-claim logic -- same code path the routine crons and
 * on-demand cache-aside refresh already use, just called across many more
 * niches at once with a bigger target. Bounded concurrency (NICHE_CONCURRENCY)
 * keeps this from firing 2*nichesPerTick live scrapes all at once.
 */
export async function runNicheVideoBackfillTick(
  admin: SupabaseClient,
  nichesPerTick: number = DEFAULT_NICHES_PER_TICK,
  platforms: VideoPlatform[] = ["tiktok", "youtube"]
): Promise<BackfillTickResult[]> {
  const targetNiches = await rankColdestNiches(nichesPerTick);

  const jobs: { niche: NicheName; platform: VideoPlatform }[] = [];
  for (const niche of targetNiches) {
    for (const platform of platforms) jobs.push({ niche, platform });
  }

  const results: BackfillTickResult[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (let i = nextIndex++; i < jobs.length; i = nextIndex++) {
      const { niche, platform } = jobs[i];
      try {
        const refreshed = await refreshNicheVideoCache(
          admin,
          niche,
          platform,
          BACKFILL_TARGET[platform],
          GLOBAL_REGION
        );
        results.push({ niche, platform, refreshed });
      } catch (err) {
        console.error(`[niche-video-backfill] tick failed (${platform}/${niche}):`, err);
        results.push({ niche, platform, refreshed: false });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(NICHE_CONCURRENCY, jobs.length) }, worker));
  return results;
}
