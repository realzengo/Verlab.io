import type { SupabaseClient } from "@supabase/supabase-js";
import { scrapeChannelVideos } from "./apify-client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NicheBendPlatform, NicheBendVideoType } from "@/lib/types";

export class FacelessIngestError extends Error {}

// Converts the scraper's already-humanized view counts ("4.2M", "980K")
// back to a number so ingestion can populate niche_channels.total_views --
// the raw numeric count never survives past apify-client's
// humanizeViewCount() call, so this is an approximation, not the literal
// source figure.
function parseHumanizedViews(value: string): number {
  const match = /^([\d.]+)\s*([KMB])?$/i.exec(value.trim());
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]);
  const suffix = match[2]?.toUpperCase();
  const multiplier = suffix === "B" ? 1_000_000_000 : suffix === "M" ? 1_000_000 : suffix === "K" ? 1_000 : 1;
  return Math.round(amount * multiplier);
}

export interface IngestChannelResult {
  channelId: string;
  channelTitle: string;
}

/**
 * Scrapes a channel's top videos (via the existing Apify/ScrapeCreators
 * pipeline in apify-client.ts) and upserts a niche_channels row for it,
 * keyed by channel_url -- ready for classifyChannel()/classifyAndStoreChannel().
 *
 * Re-ingesting an already-classified channel only refreshes title/avatar/
 * videos (the upsert payload never touches is_faceless/verified_at/etc.), so
 * it's safe to call again later to pick up new videos without wiping a prior
 * verdict.
 *
 * Note: subscriber count and channel description aren't exposed by the
 * scraper actors/endpoints currently wired up in apify-client.ts, so those
 * columns are left at their table defaults (0 / ""). The classifier still
 * works from title, recent videos, and avatar alone -- wire in a profile-info
 * source later if those signals turn out to matter for precision.
 */
export async function ingestChannel(
  url: string,
  platform: NicheBendPlatform,
  options: { videoType?: NicheBendVideoType; niche?: string } = {},
  admin: SupabaseClient = createAdminClient()
): Promise<IngestChannelResult> {
  const videoType = options.videoType ?? "shorts";
  const scraped = await scrapeChannelVideos(url, platform, videoType, 10);

  const recentVideos = scraped.videos.map((video) => ({ title: video.title }));
  const totalViews = scraped.videos.reduce((sum, video) => sum + parseHumanizedViews(video.views), 0);

  const { data, error } = await admin
    .from("niche_channels")
    .upsert(
      {
        platform,
        channel_url: url,
        channel_title: scraped.channelName,
        avatar_url: scraped.avatarUrl ?? null,
        recent_videos: recentVideos,
        total_views: totalViews,
        niche: options.niche ?? null,
      },
      { onConflict: "channel_url" }
    )
    .select("id, channel_title")
    .single();

  if (error || !data) {
    throw new FacelessIngestError(`Failed to ingest channel ${url}: ${error?.message ?? "no row returned"}`);
  }

  return { channelId: data.id, channelTitle: data.channel_title };
}
