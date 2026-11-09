import "server-only";
import { unstable_cache } from "next/cache";
import { youtubeGet } from "@/lib/server/youtube-client";
import { CLIP_SOURCE_MAX_SECONDS, type ClipSourceVideo, type DiscoverCategory } from "@/lib/clips";

// YouTube Data API reads for the Clipping page: the "Or choose" grid, its
// search box and the pasted-link preview. Quota is shared with the Niche
// Finder crons (~4,000 of the 10,000 daily units), so every call here is
// cached: charts and playlist reads cost 1 unit, search.list costs 100.

interface YoutubeVideoItem {
  id: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    channelId?: string;
    channelTitle?: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url?: string } | undefined>;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

interface YoutubeChannelItem {
  id: string;
  snippet?: { thumbnails?: Record<string, { url?: string } | undefined> };
}

// Long enough to be worth clipping; anything shorter is already short-form.
const DISCOVER_MIN_SECONDS = 4 * 60;
const DISCOVER_WINDOW_DAYS = 21;

// "Recommended" is the big creators people actually clip, not YouTube's
// trending chart (which is mostly music, trailers and regional uploads).
// Ordered by billing: the grid's first row is the top of this list.
const RECOMMENDED_CHANNELS = [
  "UCX6OQ3DkcsbYNE6H8uQQuVA", // MrBeast
  "UCGmnsW623G1r-Chmo5RB4Yw", // KSI
  "UCoEmptob-eEGKk18c2VplJg", // Kai Cenat
  "UCWsDFcIhY2DBi3GB5uykGXA", // IShowSpeed
  "UCDogdKl7t7NHzQ95aEwkdMw", // Sidemen
  "UCG8rbF3g2AMX70yOd8vqIZg", // Logan Paul
  "UCxOzbkk0bdVl6-tH1Fcajfg", // Beta Squad
  "UCcgVECVN4OKV6DH1jLkqmcA", // Jake Paul
  "UCmDTrq0LNgPodDOFZiSbsww", // xQc
  "UC63anZxfVGHUEmfBAf5w7pw", // CaseOh
  "UCnmGIkw-KdI0W5siakKPKog", // Ryan Trahan
  "UCey-eDTR5J6xU6pZ2f4guoA", // Adin Ross (Adin Live)
  "UC-lHJZR3Gqxm24_Vd_AJ5Yw", // PewDiePie
  "UCGeBogGDZ9W3dsGx-mWQGJA", // Impaulsive
  "UCyps-v4WNjWDnYRKmZ4BUGw", // Airrack
  "UC4PQqjGczpgmqbpicKjkwvw", // Druski
  "UCY1kMZp36IQSyNx_9h4mpCg", // Mark Rober
  "UCdcUmdOxMrhRjKMw-BX19AA", // Niko Omilana
  "UCWZmCMB7mmKWcXJSIPRhzZw", // Miniminter
  "UCrPseYLGpNygVi34QpGNqpA", // Ludwig
  "UCRijo3ddMTht_IHyNSNXpNQ", // Dude Perfect
];
const RECOMMENDED_PER_CHANNEL = 3;
const RECOMMENDED_MAX_AGE_DAYS = 180;

function parseIsoDuration(value: string | undefined): number {
  const match = value?.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match) return 0;
  const [, d, h, m, s] = match;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Math.round(Number(s ?? 0));
}

function bestThumbnail(thumbnails: Record<string, { url?: string } | undefined> | undefined): string {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    ""
  );
}

const count = (value: string | undefined) => (value === undefined ? null : Number(value));

async function channelAvatars(channelIds: string[]): Promise<Map<string, string>> {
  const avatars = new Map<string, string>();
  const unique = [...new Set(channelIds)].slice(0, 50);
  if (!unique.length) return avatars;
  try {
    const data = await youtubeGet<{ items?: YoutubeChannelItem[] }>("/channels", {
      part: "snippet",
      id: unique.join(","),
      maxResults: "50",
    });
    for (const item of data.items ?? []) {
      const url = item.snippet?.thumbnails?.default?.url ?? item.snippet?.thumbnails?.medium?.url;
      if (url) avatars.set(item.id, url);
    }
  } catch (error) {
    // Avatars are decoration; the grid still works without them.
    console.error("[clips/youtube] channel avatars failed:", error);
  }
  return avatars;
}

function toSourceVideo(item: YoutubeVideoItem, avatars: Map<string, string>): ClipSourceVideo {
  return {
    id: item.id,
    title: item.snippet?.title?.trim() || "Untitled video",
    channelTitle: item.snippet?.channelTitle ?? "",
    channelAvatarUrl: (item.snippet?.channelId && avatars.get(item.snippet.channelId)) || null,
    thumbnailUrl: bestThumbnail(item.snippet?.thumbnails) || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    views: count(item.statistics?.viewCount),
    likes: count(item.statistics?.likeCount),
    comments: count(item.statistics?.commentCount),
  };
}

const isClippable = (item: YoutubeVideoItem) => {
  const seconds = parseIsoDuration(item.contentDetails?.duration);
  return (
    (item.snippet?.liveBroadcastContent ?? "none") === "none" &&
    // YouTube's auto-generated "Artist - Topic" uploads are just songs.
    !item.snippet?.channelTitle?.endsWith(" - Topic") &&
    seconds >= DISCOVER_MIN_SECONDS &&
    seconds <= CLIP_SOURCE_MAX_SECONDS
  );
};

async function videosById(ids: string[]): Promise<YoutubeVideoItem[]> {
  if (!ids.length) return [];
  const data = await youtubeGet<{ items?: YoutubeVideoItem[] }>("/videos", {
    part: "snippet,contentDetails,statistics",
    id: ids.slice(0, 50).join(","),
    maxResults: "50",
  });
  // videos.list doesn't promise the request's order; keep the caller's ranking.
  const byId = new Map((data.items ?? []).map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter((item): item is YoutubeVideoItem => Boolean(item));
}

async function chart(categoryId?: string): Promise<YoutubeVideoItem[]> {
  const params: Record<string, string> = {
    part: "snippet,contentDetails,statistics",
    chart: "mostPopular",
    regionCode: "US",
    maxResults: "50",
  };
  if (categoryId) params.videoCategoryId = categoryId;
  const data = await youtubeGet<{ items?: YoutubeVideoItem[] }>("/videos", params);
  return data.items ?? [];
}

async function searchIds(params: Record<string, string>): Promise<string[]> {
  const data = await youtubeGet<{ items?: { id?: { videoId?: string } }[] }>("/search", {
    part: "snippet",
    type: "video",
    maxResults: "50",
    safeSearch: "moderate",
    ...params,
  });
  return (data.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
}

async function latestUploadIds(channelId: string): Promise<string[]> {
  const data = await youtubeGet<{ items?: { contentDetails?: { videoId?: string } }[] }>("/playlistItems", {
    part: "contentDetails",
    // A channel's uploads playlist is its id with the UC prefix swapped for UU.
    playlistId: `UU${channelId.slice(2)}`,
    // Shorts and 3h+ streams make up most uploads, so read deep enough to
    // find a few long videos; the page size doesn't change the 1-unit cost.
    maxResults: "25",
  });
  return (data.items ?? []).map((item) => item.contentDetails?.videoId).filter((id): id is string => Boolean(id));
}

async function recommended(): Promise<YoutubeVideoItem[]> {
  const uploads = await Promise.allSettled(RECOMMENDED_CHANNELS.map(latestUploadIds));
  const failures = uploads.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length === uploads.length) throw failures[0].reason;
  if (failures.length) console.error("[clips/youtube] recommended uploads failed:", failures[0].reason);

  const perChannel = uploads.map((result) => (result.status === "fulfilled" ? result.value : []));
  const ids = perChannel.flat();
  const batches = [];
  for (let start = 0; start < ids.length; start += 50) batches.push(videosById(ids.slice(start, start + 50)));
  const details = new Map((await Promise.all(batches)).flat().map((item) => [item.id, item]));

  const cutoff = Date.now() - RECOMMENDED_MAX_AGE_DAYS * 86_400_000;
  const columns = perChannel.map((channelIds) =>
    channelIds
      .flatMap((id) => {
        const item = details.get(id);
        return item && isClippable(item) && Date.parse(item.snippet?.publishedAt ?? "") >= cutoff ? [item] : [];
      })
      .slice(0, RECOMMENDED_PER_CHANNEL)
  );
  // Round-robin, so the grid opens on each creator's newest video rather
  // than one daily streamer's whole week.
  const interleaved: YoutubeVideoItem[] = [];
  for (let round = 0; round < RECOMMENDED_PER_CHANNEL; round++) {
    for (const column of columns) if (column[round]) interleaved.push(column[round]);
  }
  return interleaved;
}

function recentWindow(): string {
  // Rounded to the day so the cached search key doesn't change every call.
  const day = Math.floor(Date.now() / 86_400_000) - DISCOVER_WINDOW_DAYS;
  return new Date(day * 86_400_000).toISOString();
}

async function finish(items: YoutubeVideoItem[]): Promise<ClipSourceVideo[]> {
  const seen = new Set<string>();
  const clippable = items.filter((item) => isClippable(item) && !seen.has(item.id) && seen.add(item.id));
  const avatars = await channelAvatars(clippable.map((item) => item.snippet?.channelId ?? "").filter(Boolean));
  return clippable.map((item) => toSourceVideo(item, avatars));
}

async function loadCategory(category: DiscoverCategory): Promise<ClipSourceVideo[]> {
  switch (category) {
    case "recommended":
      return finish(await recommended());
    case "gaming":
      return finish(await chart("20"));
    case "news":
      return finish(await chart("25"));
    case "podcasts":
      return finish(
        await videosById(
          await searchIds({
            q: "podcast",
            videoDuration: "long",
            order: "viewCount",
            publishedAfter: recentWindow(),
            regionCode: "US",
            relevanceLanguage: "en",
          })
        )
      );
    case "sports":
      return finish(
        await videosById(
          await searchIds({
            videoCategoryId: "17",
            videoDuration: "medium",
            order: "viewCount",
            publishedAfter: recentWindow(),
            regionCode: "US",
          })
        )
      );
    case "entertainment":
      return finish(
        await videosById(
          await searchIds({
            videoCategoryId: "24",
            videoDuration: "medium",
            order: "viewCount",
            publishedAfter: recentWindow(),
            regionCode: "US",
          })
        )
      );
  }
}

export const discoverClipSources = unstable_cache(loadCategory, ["clips-discover-v2"], { revalidate: 12 * 3600 });

export const searchClipSources = unstable_cache(
  async (query: string) => finish(await videosById(await searchIds({ q: query, relevanceLanguage: "en" }))),
  ["clips-search-v1"],
  { revalidate: 6 * 3600 }
);

/**
 * One video's details, or null when YouTube doesn't know the id. Not
 * length-filtered: live streams and upcoming premieres report a duration of
 * 0, which the caller turns into its own message.
 */
export const getClipSourceVideo = unstable_cache(
  async (videoId: string): Promise<ClipSourceVideo | null> => {
    const [item] = await videosById([videoId]);
    if (!item) return null;
    const avatars = await channelAvatars(item.snippet?.channelId ? [item.snippet.channelId] : []);
    return toSourceVideo(item, avatars);
  },
  ["clips-video-v1"],
  { revalidate: 3600 }
);
