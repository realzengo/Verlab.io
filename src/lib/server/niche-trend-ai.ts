import { generateObject, generateText, type ModelMessage } from "ai";
import { z } from "zod";
import { OPENROUTER_MAX_OUTPUT_TOKENS, nicheTrendResearchModel, openrouterInstructModel } from "./openrouter-client";

export class NicheTrendAiError extends Error {}

const SYSTEM_PROMPT = `You are Verlab's trend research analyst. You track currently-trending faceless short-form video niches across TikTok, YouTube Shorts, and Instagram Reels — channels that never show a real on-camera host, spanning every faceless production style: narrated/voiceover-over-footage (true crime breakdowns, business post-mortems, history deep-dives), AI-generated content (AI voiceover with AI-generated visuals or avatars, AI storytelling series), and 2D animation (animated explainers, animated storytime, animated comics). You are evidence-based: every niche you report must be grounded in real, currently-visible videos you found via web search, and you cite real example titles and view counts. No hype, no invented statistics.`;

const SampleVideoSchema = z.object({
  title: z.string(),
  views: z.string(),
});

const NicheTrendSchema = z.object({
  slug: z.string().describe("stable, lowercase, hyphenated identifier, e.g. medical-malpractice"),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  faceless: z.boolean(),
  tags: z.array(z.string()),
  platform: z.enum(["tiktok", "youtube", "instagram", "mixed"]),
  momentumScore: z.number().min(0).max(100),
  momentumTrend: z.enum(["up", "down", "flat"]),
  sampleVideos: z.array(SampleVideoSchema),
});

const NicheTrendsSchema = z.object({ niches: z.array(NicheTrendSchema) });

export type NicheTrend = z.infer<typeof NicheTrendSchema>;

function wrapProviderError(error: unknown): never {
  if (error instanceof NicheTrendAiError) throw error;
  const message = error instanceof Error ? error.message : String(error);
  throw new NicheTrendAiError(`OpenRouter request failed: ${message}`);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new NicheTrendAiError(timeoutMessage)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverTrendingNiches(): Promise<NicheTrend[]> {
  // Pass 1: grounded free-text research via Perplexity's Sonar (natively
  // search-grounded through OpenRouter, no separate tool wiring needed).
  // Still split from extraction into two calls: Sonar isn't a reliable
  // structured-output model, so a second, plain instruct model shapes the
  // research text into the schema instead.
  const researchPrompt = `Research currently-trending FACELESS short-form video niches right now across TikTok, YouTube Shorts, and Instagram Reels. Use web search to ground every claim in real, currently-circulating videos.

Find 7-10 distinct niches, and make sure the set you return is NOT all narration-over-footage — deliberately include a mix across all three faceless production styles:
- Narrated/voiceover niches (true crime breakdowns, business post-mortems, history deep-dives, etc.)
- AI-generated niches (AI voiceover paired with AI-generated visuals or AI avatars, AI storytime/story series)
- 2D animation niches (animated explainers, animated storytime, animated comics)

Aim for at least 1-2 real niches from each of the AI-generated and 2D-animation styles, not just narration ones. For each niche, note:
- name and category (e.g. "True crime", "Business", "History", "AI storytelling", "2D animation")
- what these videos actually cover and why they work
- which of the three production styles above it is (tag it as such in the tags you output)
- which platform (tiktok/youtube/instagram) is most associated with this niche right now, or if it's spread evenly across them
- how much view/growth momentum this niche has right now relative to the others, and whether it's accelerating, fading, or steady
- 2-3 REAL example videos you found via search, with their actual titles and view counts (mark clearly estimated counts, don't fabricate precision)

Use at most 8 searches. Do not invent video titles or view counts — if you can't confirm real examples for a niche, drop that niche rather than making one up. End with a clear plain-text summary covering every niche you found.`;

  const messages: ModelMessage[] = [{ role: "user", content: researchPrompt }];

  let researchText: string;
  try {
    const { text } = await withTimeout(
      generateText({
        model: nicheTrendResearchModel,
        system: SYSTEM_PROMPT,
        messages,
      }),
      200_000,
      `OpenRouter took too long to respond (over 200s).`
    );
    researchText = text;
  } catch (error) {
    wrapProviderError(error);
  }

  // Pass 2: no grounding tool, just shape the research summary above into
  // the Zod schema.
  const extractionPrompt = `Based on your research above, structure every niche you found into the required format: a stable slug (lowercase, hyphenated, e.g. "medical-malpractice"), name, category, description (one sentence), faceless, tags (2-4 short tags — always include one of "narrated", "ai-generated", or "2d-animation" to mark its production style), platform, momentumScore (0-100, relative to the others you found), momentumTrend, and sampleVideos (the real titles/view counts you found, as strings like "4.2M"). Respond only in the required structured format.`;

  const messagesWithExtraction: ModelMessage[] = [
    ...messages,
    { role: "assistant", content: researchText },
    { role: "user", content: extractionPrompt },
  ];

  try {
    const { object } = await withTimeout(
      generateObject({
        model: openrouterInstructModel,
        system: SYSTEM_PROMPT,
        messages: messagesWithExtraction,
        schema: NicheTrendsSchema,
        maxOutputTokens: Math.min(4000, OPENROUTER_MAX_OUTPUT_TOKENS),
      }),
      120_000,
      `OpenRouter took too long to respond (over 120s).`
    );
    return object.niches;
  } catch (error) {
    wrapProviderError(error);
  }
}
