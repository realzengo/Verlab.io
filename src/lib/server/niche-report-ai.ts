import { google } from "@ai-sdk/google";
import { generateObject, generateText, type ModelMessage } from "ai";
import { z } from "zod";
import { GEMINI_MAX_OUTPUT_TOKENS, geminiModel } from "./gemini-client";

export class NicheReportAiError extends Error {}

// Mirrors niche-trend-ai.ts's two-pass grounded-research pattern (Gemini
// can't combine Google Search grounding with structured output in one call)
// but personalized: the research prompt itself is built from the creator's
// form answers instead of running generically.
const GROUNDED_SYSTEM_PROMPT = `You are Verlab's niche research analyst. You track currently-trending faceless short-form video niches across TikTok and YouTube (Shorts and long-form). You are evidence-based: every niche you report must be grounded in real, currently-visible videos you found via web search, and you cite real example titles and view counts. No hype, no invented statistics. You always tailor your picks and reasoning to the specific creator you're researching for -- their interests, background, and constraints -- rather than giving generic advice.`;

// Used only when the grounded pass fails (e.g. Google Search grounding has a
// much tighter quota than plain generation, so it's the one that runs out
// first) -- same personality, but explicitly told not to claim live
// verification it doesn't have.
const FALLBACK_SYSTEM_PROMPT = `You are Verlab's niche research analyst. Live web search is temporarily unavailable, so you're working from your own training knowledge of faceless short-form video niches on TikTok and YouTube (Shorts and long-form) instead of real-time search. Be upfront about that limitation in tone -- describe niches as durable/growing rather than claiming anything is happening "right now," and don't fabricate precise view counts, only give plausible, clearly-approximate figures. You always tailor your picks and reasoning to the specific creator you're researching for -- their interests, background, and constraints -- rather than giving generic advice.`;

const SampleVideoSchema = z.object({ title: z.string(), views: z.string() });

const NicheReportEntrySchema = z.object({
  name: z.string(),
  platform: z.enum(["youtube", "tiktok", "both"]),
  category: z.string(),
  description: z.string().describe("One or two sentences on what these videos actually cover."),
  whyForYou: z
    .string()
    .describe(
      "One or two sentences tying this niche directly to what the creator told you -- their interests, background, or the channels they already like."
    ),
  angle: z
    .string()
    .describe("A specific, concrete starter video idea or format angle, tailored to their format/production-style/budget answers."),
  momentumScore: z.number().min(0).max(100),
  momentumTrend: z.enum(["up", "down", "flat"]),
  sampleVideos: z.array(SampleVideoSchema).min(1).max(4),
});

const NicheReportSchema = z.object({ niches: z.array(NicheReportEntrySchema).min(4).max(8) });

export type NicheReportEntry = z.infer<typeof NicheReportEntrySchema>;

export type NicheReportPlatform = "youtube" | "tiktok" | "both";

export interface NicheFinderAnswers {
  interests: string;
  channelsTheyLike: string;
  platform: NicheReportPlatform;
  format: "long-form" | "shorts" | "not-sure";
  productionStyle: "ai-visuals" | "animation" | "real-footage" | "no-preference";
  background: string;
  budget: number | null;
}

export interface NicheReportResult {
  niches: NicheReportEntry[];
  // false when the grounded (live web search) pass failed and this fell
  // back to Gemini's own training knowledge instead -- the widget shows a
  // notice in that case rather than silently presenting stale info as live.
  live: boolean;
}

function wrapProviderError(error: unknown): never {
  if (error instanceof NicheReportAiError) throw error;
  const message = error instanceof Error ? error.message : String(error);
  throw new NicheReportAiError(`Gemini request failed: ${message}`);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new NicheReportAiError(timeoutMessage)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const PLATFORM_LABEL: Record<NicheReportPlatform, string> = {
  youtube: "YouTube (Shorts and/or long-form)",
  tiktok: "TikTok",
  both: "both YouTube and TikTok",
};

function answersBlock(answers: NicheFinderAnswers): string {
  return `- What they could talk about for hours: ${answers.interests || "(not given)"}
- Channels they already like: ${answers.channelsTheyLike || "(not given)"}
- Long-form or Shorts: ${answers.format}
- How they want videos made: ${answers.productionStyle}
- Background/skill to pull from: ${answers.background || "(not given)"}
- Monthly budget: ${answers.budget != null ? `$${answers.budget}/mo` : "(not given)"}`;
}

async function researchViralNichesGrounded(answers: NicheFinderAnswers): Promise<NicheReportEntry[]> {
  const researchPrompt = `Research short-form video niches that are going VIRAL RIGHT NOW on ${PLATFORM_LABEL[answers.platform]}. Use web search to ground every claim in real, currently-circulating videos -- do not invent titles or view counts.

Here's the creator you're researching for:
${answersBlock(answers)}

Find 5-7 distinct niches that are currently gaining real momentum, weighted toward ones that plausibly fit THIS creator's interests, background, and constraints -- but don't force a fit that isn't real; include at least 1-2 niches outside their stated interests if those are genuinely exploding right now, so they see the full picture. For each niche, note:
- name and category
- what these videos actually cover and why they're working right now
- which platform (YouTube, TikTok, or both) is most associated with it right now
- how much view/growth momentum it has relative to the others, and whether it's accelerating, fading, or steady
- 2-4 REAL example videos you found via search, with actual titles and view counts (mark clearly estimated counts, don't fabricate precision)
- specifically why it would or wouldn't suit this creator given their answers above

Use at most 8 searches. If you can't confirm real examples for a niche, drop it rather than making one up. End with a clear plain-text summary covering every niche you found.`;

  const messages: ModelMessage[] = [{ role: "user", content: researchPrompt }];

  const { text: researchText } = await withTimeout(
    generateText({
      model: geminiModel,
      system: GROUNDED_SYSTEM_PROMPT,
      messages,
      tools: { google_search: google.tools.googleSearch({}) },
    }),
    200_000,
    `Gemini took too long to respond (over 200s).`
  );

  const extractionPrompt = `Based on your research above, structure every niche you found into the required format: name, platform (youtube/tiktok/both), category, description, whyForYou (tie it directly to this specific creator's answers, even for niches you included as wildcards outside their stated interests), angle (one concrete starter video idea respecting their format/production-style/budget answers), momentumScore (0-100, relative to the others you found), momentumTrend, and sampleVideos (the real titles/view counts you found, as strings like "4.2M"). Respond only in the required structured format.`;

  const messagesWithExtraction: ModelMessage[] = [
    ...messages,
    { role: "assistant", content: researchText },
    { role: "user", content: extractionPrompt },
  ];

  const { object } = await withTimeout(
    generateObject({
      model: geminiModel,
      system: GROUNDED_SYSTEM_PROMPT,
      messages: messagesWithExtraction,
      schema: NicheReportSchema,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    }),
    120_000,
    `Gemini took too long to respond (over 120s).`
  );
  return object.niches;
}

// No search tool involved -- a single structured-output call straight from
// Gemini's training knowledge. Deliberately cheaper (one call, not two) as
// well as more resilient: Google Search grounding has its own, much
// tighter quota separate from plain generation, so this path can still
// succeed even when that quota is exhausted.
async function researchViralNichesFallback(answers: NicheFinderAnswers): Promise<NicheReportEntry[]> {
  const prompt = `Live web search is unavailable right now. From your own knowledge, name 5-7 faceless short-form video niches on ${PLATFORM_LABEL[answers.platform]} that have shown durable, real growth (not necessarily breaking news-fresh, but genuinely popular niches you're confident about).

Here's the creator you're researching for:
${answersBlock(answers)}

Weight your picks toward ones that plausibly fit THIS creator's interests, background, and constraints -- but include at least 1-2 solid niches outside their stated interests too, so they see the full picture. For each niche, give: name, category, description, platform (youtube/tiktok/both), momentumScore (0-100, relative to the others), momentumTrend, whyForYou (tied to this specific creator's answers), angle (one concrete starter video idea respecting their format/production-style/budget), and sampleVideos (plausible representative example titles + approximate view counts you're aware of -- mark them as approximate, don't fabricate false precision).`;

  const { object } = await withTimeout(
    generateObject({
      model: geminiModel,
      system: FALLBACK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      schema: NicheReportSchema,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    }),
    120_000,
    `Gemini took too long to respond (over 120s).`
  );
  return object.niches;
}

export async function researchViralNiches(answers: NicheFinderAnswers): Promise<NicheReportResult> {
  try {
    const niches = await researchViralNichesGrounded(answers);
    return { niches, live: true };
  } catch (groundedError) {
    console.error("[niche-report-ai] grounded research failed, falling back to non-grounded Gemini:", groundedError);
    try {
      const niches = await researchViralNichesFallback(answers);
      return { niches, live: false };
    } catch (fallbackError) {
      wrapProviderError(fallbackError);
    }
  }
}
