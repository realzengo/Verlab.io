import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchNicheTrendingVideos } from "@/lib/server/sociavault-client";
import { fetchNicheYoutubeVideos } from "@/lib/server/youtube-client";
import { NICHE_HASHTAGS, type NicheName } from "@/lib/niches-catalog";

export type VideoPlatform = "tiktok" | "youtube";

// Cache-aside knobs. Unlike a flat one-time batch size, the pool a niche
// needs to satisfy a request now scales with how deep the caller has
// paginated — page 3 at limit=20 needs 60 cached rows, not a fixed 150 —
// which is what gives the "infinite" pagination feel: the cache grows on
// demand as the user keeps hitting Next, instead of being capped upfront.
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BACKFILL_BUFFER = 40;
// Lock TTL: long enough to cover a full scrape across a niche's keywords,
// short enough that a crashed request doesn't wedge the niche for a day.
const LOCK_TTL_MS = 2 * 60 * 1000;

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// YouTube's regionCode biases search relevance toward a country — TikTok has
// no equivalent (SociaVault's hashtag search takes no region param), so
// TikTok rows are always tagged 'global' regardless of what's requested.
export const GLOBAL_REGION = "global";

export async function isNicheCacheStale(
  supabase: SupabaseServer,
  niche: string,
  platform: VideoPlatform,
  country: string = GLOBAL_REGION
): Promise<boolean> {
  const { data, error } = await supabase
    .from("trending_videos")
    .select("refreshed_at")
    .eq("niche_category", niche)
    .eq("platform", platform)
    .eq("region", country)
    .order("refreshed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return true;

  return Date.now() - new Date(data.refreshed_at).getTime() >= CACHE_TTL_MS;
}

// Atomically flips this (niche, platform, country) lock row from idle (or
// abandoned-stale) to refreshing, so concurrent requests for the same stale
// niche don't each kick off their own scrape — only the request that wins
// the claim scrapes.
async function claimNicheRefresh(
  admin: SupabaseAdmin,
  niche: string,
  platform: VideoPlatform,
  country: string
): Promise<boolean> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TTL_MS).toISOString();

  const { data: updated, error: updateError } = await admin
    .from("niche_video_refresh_locks")
    .update({ status: "refreshing", started_at: now.toISOString() })
    .eq("niche_category", niche)
    .eq("platform", platform)
    .eq("country", country)
    .or(`status.eq.idle,started_at.lt.${staleBefore}`)
    .select("niche_category");

  if (!updateError && updated && updated.length > 0) return true;

  // No lock row exists yet for this (niche, platform, country) — first-ever
  // request. Insert one; if a concurrent request beat us to it, the primary
  // key conflict means we lost the race and simply skip scraping this time.
  const { error: insertError } = await admin
    .from("niche_video_refresh_locks")
    .insert({ niche_category: niche, platform, country, status: "refreshing", started_at: now.toISOString() });

  return !insertError;
}

async function releaseNicheRefresh(
  admin: SupabaseAdmin,
  niche: string,
  platform: VideoPlatform,
  country: string
): Promise<void> {
  await admin
    .from("niche_video_refresh_locks")
    .update({ status: "idle", finished_at: new Date().toISOString() })
    .eq("niche_category", niche)
    .eq("platform", platform)
    .eq("country", country);
}

// Returns whether new rows were actually written, so the caller knows
// whether re-querying Supabase afterward is worth doing. `country` is a
// YouTube regionCode (e.g. "US"); ignored for TikTok, defaults to
// GLOBAL_REGION ("worldwide", no bias) for YouTube.
export async function refreshNicheVideoCache(
  admin: SupabaseAdmin,
  niche: NicheName,
  platform: VideoPlatform,
  targetCount: number,
  country: string = GLOBAL_REGION
): Promise<boolean> {
  const region = platform === "youtube" ? country : GLOBAL_REGION;
  const claimed = await claimNicheRefresh(admin, niche, platform, region);
  if (!claimed) return false;

  try {
    let scraped;
    if (platform === "tiktok") {
      // Follower counts are intentionally NOT backfilled here -- this scrape
      // can pull in a large buffered batch (targetCount + BACKFILL_BUFFER),
      // most of which is only cached ahead for future pagination and never
      // actually shown. Backfilling here meant paying 1 SociaVault credit
      // per author for videos nobody had viewed yet. Follower counts are
      // resolved lazily instead, bounded to exactly the page a user actually
      // requests -- see backfillPageFollowerCounts in niche-video-query.ts.
      scraped = await fetchNicheTrendingVideos(NICHE_HASHTAGS[niche], targetCount + BACKFILL_BUFFER);
    } else {
      scraped = await fetchNicheYoutubeVideos(
        NICHE_HASHTAGS[niche],
        targetCount + BACKFILL_BUFFER,
        region === GLOBAL_REGION ? null : region
      );
    }
    if (scraped.length === 0) return false;

    const { error: upsertError } = await admin.from("trending_videos").upsert(
      scraped.map((v) => ({
        id: v.id,
        title: v.title,
        views: v.views,
        view_count: v.viewCount,
        like_count: v.likeCount,
        comment_count: v.commentCount,
        share_count: v.shareCount,
        follower_count: v.followerCount,
        cover_url: v.coverUrl,
        video_url: v.videoUrl,
        author: v.author,
        avatar_url: v.avatarUrl,
        hashtag: v.hashtag,
        niche_category: niche,
        platform,
        region,
        posted_at: v.postedAt,
        refreshed_at: new Date().toISOString(),
      })),
      { onConflict: "id" }
    );
    if (upsertError) {
      console.error(`[niche-video-refresh] upsert failed (${platform}/${niche}/${region}):`, upsertError.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[niche-video-refresh] scrape failed (${platform}/${niche}/${region}):`, err);
    return false;
  } finally {
    await releaseNicheRefresh(admin, niche, platform, region);
  }
}
