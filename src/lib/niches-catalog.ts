// Live trending videos are sourced from hashtag searches (see
// fetchFacelessTrendingVideos / fetchNicheTrendingVideos in sociavault-client.ts)
// rather than a dedicated classification pass. This file is the single
// source of truth mapping each niche to the hashtags that feed it, so the
// ingestion pipeline (server) and the UI (client) never drift out of sync.

// Fixed display order — stable regardless of which niches currently have
// videos, so the sidebar list doesn't reshuffle as data changes.
export const NICHE_ORDER = [
  "History",
  "Horror",
  "Crime",
  "Finance",
  "Education",
  "Storytelling",
  "Entertainment",
  "Animals",
  "Explained",
  "Engineering",
  "Military",
  "Sport",
  "Technology",
  "Psychology",
  "Religion",
  "Crime & Psychology",
  "Fitness & Health",
  "Politics",
  "Stats",
  "Gaming",
  "Games",
  "3D Animation",
  "Movie Commentary",
  "Whiteboard",
  "Cars",
  "Quizzes & Trivia",
  "Brainrot",
  "Geography",
  "Media",
  "Celebrity",
  "Bodycam",
] as const;

export type NicheName = (typeof NICHE_ORDER)[number];

export const NICHE_HASHTAGS: Record<NicheName, string[]> = {
  History: ["historyfacts"],
  Horror: ["scarystories", "mysteryfacts"],
  Crime: ["truecrime"],
  Finance: ["businessfacts"],
  Education: ["educationfacts"],
  Storytelling: ["aistorytime", "2danimation", "animatedstory", "redditstories"],
  Entertainment: ["motivationalstory"],
  Animals: ["animalfacts"],
  Explained: ["factsyoudidntknow", "didyouknowfacts"],
  Engineering: ["engineeringfacts"],
  Military: ["militaryfacts"],
  Sport: ["sportsfacts"],
  Technology: ["aigenerated", "aivoiceover"],
  Psychology: ["psychologyfacts"],
  Religion: ["religionfacts"],
  "Crime & Psychology": ["criminalpsychology"],
  "Fitness & Health": ["fitnessfacts", "healthfacts"],
  Politics: ["politicsfacts"],
  Stats: ["statsfacts"],
  Gaming: ["gamingfacts"],
  Games: ["videogamefacts"],
  "3D Animation": ["3danimation", "3dart", "blender3d"],
  "Movie Commentary": ["moviecommentary", "movierecap", "filmtok", "commentarytiktok"],
  Whiteboard: ["whiteboardanimation", "whiteboardvideo"],
  Cars: ["carfacts", "carsoftiktok", "cartok"],
  "Quizzes & Trivia": ["quiztime", "triviafacts", "guessthemovie"],
  Brainrot: ["brainrot", "brainrotcontent"],
  Geography: ["geographyfacts", "mapfacts"],
  Media: ["movietok", "tvfacts"],
  Celebrity: ["celebrityfacts", "celebritytea"],
  Bodycam: ["bodycam", "bodycamfootage"],
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

/** True only for hashtags actually in our catalog (unlike nicheForHashtag,
 * which always resolves to *some* niche via DEFAULT_VIDEO_NICHE) -- lets a
 * caller distinguish "this video genuinely matched one of our niches" from
 * "nothing matched, we're guessing" for content not sourced from a
 * per-niche hashtag search (e.g. a global trending feed). */
export function isKnownHashtag(hashtag: string): boolean {
  return hashtag.toLowerCase() in HASHTAG_TO_NICHE;
}

export function isNicheName(value: string): value is NicheName {
  return (NICHE_ORDER as readonly string[]).includes(value);
}
