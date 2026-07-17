// Live trending videos are sourced from hashtag searches (see
// fetchFacelessTrendingVideos / fetchNicheTrendingVideos in apify-client.ts)
// rather than a dedicated classification pass. This file is the single
// source of truth mapping each niche to the hashtags that feed it, so the
// ingestion pipeline (server) and the UI (client) never drift out of sync.

// Fixed display order — stable regardless of which niches currently have
// videos, so the sidebar list doesn't reshuffle as data changes.
export const NICHE_ORDER = [
  "Technology",
  "Finance",
  "Horror",
  "Explained",
  "Conspiracy",
  "History",
  "Storytelling",
  "Crime",
  "Psychology",
  "Entertainment",
] as const;

export type NicheName = (typeof NICHE_ORDER)[number];

export const NICHE_HASHTAGS: Record<NicheName, string[]> = {
  Technology: ["aigenerated", "aivoiceover"],
  Finance: ["businessfacts"],
  Horror: ["scarystories", "mysteryfacts"],
  Explained: ["factsyoudidntknow", "didyouknowfacts"],
  Conspiracy: ["conspiracytheory"],
  History: ["historyfacts"],
  Storytelling: ["aistorytime", "2danimation", "animatedstory", "redditstories"],
  Crime: ["truecrime"],
  Psychology: ["psychologyfacts"],
  Entertainment: ["motivationalstory"],
};

const HASHTAG_TO_NICHE: Record<string, NicheName> = Object.fromEntries(
  Object.entries(NICHE_HASHTAGS).flatMap(([niche, hashtags]) =>
    hashtags.map((hashtag) => [hashtag, niche as NicheName])
  )
);

export const DEFAULT_VIDEO_NICHE: NicheName = "Entertainment";

export function nicheForHashtag(hashtag: string): NicheName {
  return HASHTAG_TO_NICHE[hashtag.toLowerCase()] ?? DEFAULT_VIDEO_NICHE;
}

export function isNicheName(value: string): value is NicheName {
  return (NICHE_ORDER as readonly string[]).includes(value);
}
