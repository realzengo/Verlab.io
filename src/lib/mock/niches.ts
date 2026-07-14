import type { Niche } from "@/lib/types";

function videos(prefix: string, titles: [string, string][]): Niche["sampleVideos"] {
  return titles.map(([title, views], i) => ({
    id: `${prefix}-v${i + 1}`,
    thumbnailUrl: `/mock/thumbs/${prefix}-${i + 1}.jpg`,
    title,
    views,
  }));
}

export const NICHES: Niche[] = [
  {
    id: "medical-malpractice",
    name: "Medical Malpractice",
    category: "True crime",
    momentumScore: 94,
    momentumTrend: "up",
    description:
      "Faceless breakdowns of real malpractice cases — the mistake, the coverup, the payout.",
    faceless: true,
    tags: ["true crime", "medical", "faceless"],
    sampleVideos: videos("medmal", [
      ["The $2.3M mistake surgeons hope you never learn about", "4.2M"],
      ["Why this common ER shortcut kills 40 people a year", "3.1M"],
      ["The consent form loophole hospitals don't want you reading", "2.8M"],
    ]),
  },
  {
    id: "corporate-espionage",
    name: "Corporate Espionage",
    category: "Business",
    momentumScore: 88,
    momentumTrend: "up",
    description:
      "Stories of leaked trade secrets, planted moles, and the takedowns that followed.",
    faceless: true,
    tags: ["business", "espionage", "faceless"],
    sampleVideos: videos("corpespionage", [
      ["The intern who leaked a decade of trade secrets", "5.6M"],
      ["How a rival's mole sat in on every board meeting", "3.9M"],
      ["The patent filing that exposed the whole scheme", "2.4M"],
    ]),
  },
  {
    id: "financial-collapse",
    name: "Financial Collapse",
    category: "Business",
    momentumScore: 81,
    momentumTrend: "flat",
    description:
      "The trades, the warning signs, and the collapses that took entire institutions down.",
    faceless: true,
    tags: ["finance", "history", "faceless"],
    sampleVideos: videos("fincollapse", [
      ["The trade that erased a nation's pension fund", "3.3M"],
      ["Every warning sign regulators chose to ignore", "2.1M"],
      ["How one bad bet took down a 150-year-old bank", "4.0M"],
    ]),
  },
  {
    id: "military-disasters",
    name: "Military Disasters",
    category: "History",
    momentumScore: 76,
    momentumTrend: "up",
    description:
      "The battle plans, radio silences, and split-second decisions that doomed campaigns.",
    faceless: true,
    tags: ["history", "military", "faceless"],
    sampleVideos: videos("mildisaster", [
      ["The battle plan that doomed 40,000 soldiers", "2.9M"],
      ["The radio silence that lost an entire war", "1.8M"],
      ["Every way generals have sent armies to slaughter", "3.5M"],
    ]),
  },
  {
    id: "cult-breakdowns",
    name: "Cult Breakdowns",
    category: "True crime",
    momentumScore: 72,
    momentumTrend: "up",
    description:
      "How charismatic leaders built (and lost) total control over their followers.",
    faceless: true,
    tags: ["true crime", "psychology", "faceless"],
    sampleVideos: videos("cultbreak", [
      ["The recruiting tactic that hooked 4,000 members", "2.2M"],
      ["The night the compound turned on itself", "1.6M"],
    ]),
  },
  {
    id: "unsolved-disappearances",
    name: "Unsolved Disappearances",
    category: "True crime",
    momentumScore: 69,
    momentumTrend: "down",
    description: "Cold cases, the last known sighting, and the theories that never died.",
    faceless: true,
    tags: ["true crime", "mystery", "faceless"],
    sampleVideos: videos("disappear", [
      ["The last text message before she vanished", "1.9M"],
      ["Every clue investigators missed for 12 years", "1.4M"],
    ]),
  },
  {
    id: "engineering-failures",
    name: "Engineering Failures",
    category: "Science",
    momentumScore: 64,
    momentumTrend: "flat",
    description: "The calculation errors and cut corners behind history's biggest collapses.",
    faceless: true,
    tags: ["science", "engineering", "faceless"],
    sampleVideos: videos("engfail", [
      ["The decimal point error that collapsed a bridge", "1.2M"],
      ["Why this skyscraper almost fell in a windstorm", "980K"],
    ]),
  },
];
