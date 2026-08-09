import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchTikTokProfileFollowerCount } from "@/lib/server/sociavault-client";

// Real follower counts cost 1 SociaVault credit per handle (see
// fetchTikTokProfileFollowerCount) -- cache them for a week so an author
// showing up across many niches/refreshes only gets looked up once, not on
// every refresh cycle (trending_videos itself only caches for 24h).
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Bounds concurrent profile lookups within one backfill call -- a niche
// refresh can surface 50-100+ distinct authors at once, and firing that many
// requests at SociaVault simultaneously isn't worth the marginal latency win.
const CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Core primitive: resolve real follower counts for a set of TikTok handles,
// serving cached values where fresh and only paying for a profile lookup on
// whatever's missing or stale. A handle whose lookup fails is simply absent
// from the returned map -- callers fall back to whatever they already had.
async function resolveFollowerCounts(admin: SupabaseClient, handles: string[]): Promise<Map<string, number>> {
  const uniqueHandles = [...new Set(handles)];
  if (uniqueHandles.length === 0) return new Map();

  const { data: cached } = await admin
    .from("tiktok_author_follower_cache")
    .select("handle, follower_count, refreshed_at")
    .in("handle", uniqueHandles);

  const followerByHandle = new Map<string, number>();
  const staleBefore = Date.now() - CACHE_TTL_MS;
  const staleOrMissing: string[] = [];

  for (const handle of uniqueHandles) {
    const row = cached?.find((c) => c.handle === handle);
    if (row && new Date(row.refreshed_at).getTime() > staleBefore) {
      followerByHandle.set(handle, row.follower_count);
    } else {
      staleOrMissing.push(handle);
    }
  }

  if (staleOrMissing.length > 0) {
    const fetched = await mapWithConcurrency(staleOrMissing, CONCURRENCY, async (handle) => {
      try {
        return { handle, followerCount: await fetchTikTokProfileFollowerCount(handle) };
      } catch (err) {
        console.error(`[tiktok-follower-cache] profile lookup failed for @${handle}:`, err);
        return null;
      }
    });

    const resolved = fetched.filter((f): f is { handle: string; followerCount: number } => f !== null);
    for (const { handle, followerCount } of resolved) {
      followerByHandle.set(handle, followerCount);
    }

    if (resolved.length > 0) {
      await admin.from("tiktok_author_follower_cache").upsert(
        resolved.map(({ handle, followerCount }) => ({
          handle,
          follower_count: followerCount,
          refreshed_at: new Date().toISOString(),
        })),
        { onConflict: "handle" }
      );
    }
  }

  return followerByHandle;
}

export async function fetchTikTokFollowerCounts(admin: SupabaseClient, handles: string[]): Promise<Map<string, number>> {
  return resolveFollowerCounts(admin, handles);
}

// videoUrl is always "https://www.tiktok.com/@<handle>/video/<id>" -- built
// that way in sociavault-client.ts's mapAwemeItems/mapTrendingFeedItems.
function handleFromVideoUrl(videoUrl: string): string | null {
  return /tiktok\.com\/@([^/]+)\/video\//.exec(videoUrl)?.[1] ?? null;
}

// Mutates and returns `videos` with real follower counts swapped in wherever
// resolvable, leaving the search endpoint's placeholder 0 untouched for any
// handle a lookup failed for.
export async function backfillTikTokVideoFollowerCounts<T extends { videoUrl: string; followerCount: number }>(
  admin: SupabaseClient,
  videos: T[]
): Promise<T[]> {
  const handles = videos.map((v) => handleFromVideoUrl(v.videoUrl)).filter((h): h is string => !!h);
  const followerByHandle = await resolveFollowerCounts(admin, handles);

  for (const video of videos) {
    const handle = handleFromVideoUrl(video.videoUrl);
    const followerCount = handle ? followerByHandle.get(handle) : undefined;
    if (followerCount !== undefined) video.followerCount = followerCount;
  }

  return videos;
}
