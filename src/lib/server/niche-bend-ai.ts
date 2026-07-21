import { generateObject, type ModelMessage } from "ai";
import { z } from "zod";
import { ApifyScraperError, scrapeChannelVideos } from "./apify-client";
import { CLAUDE_MAX_OUTPUT_TOKENS, nicheBendModel } from "./cloudflare-client";
import type {
  NicheBendCandidate,
  NicheBendChannelAnalysis,
  NicheBendPlatform,
  NicheBendSopContent,
  NicheBendVideo,
  NicheBendVideoType,
} from "@/lib/types";

export class NicheBendAiError extends Error {}

const SYSTEM_PROMPT = `You are Verlab's niche-bending strategist: an expert short-form video (YouTube/TikTok) scripting analyst. You reverse-engineer what makes a channel's videos work — hooks, structure, pacing, retention devices — and you write precise, actionable playbooks other creators can execute from. You are terse, concrete, and evidence-based: every claim you make must be grounded in real videos from the channel you're analyzing, and you cite which specific videos support it. No hype, no vague advice, no generic content-creator platitudes.`;

function wrapProviderError(error: unknown): never {
  if (error instanceof NicheBendAiError) throw error;
  const message = error instanceof Error ? error.message : String(error);
  throw new NicheBendAiError(`Claude request failed: ${message}`);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new NicheBendAiError(timeoutMessage)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function runExtract<Schema extends z.ZodTypeAny>(
  messages: ModelMessage[],
  schema: Schema,
  opts: { maxOutputTokens: number; wallClockTimeoutMs?: number }
): Promise<{ object: z.infer<Schema>; messages: ModelMessage[] }> {
  const wallClockTimeoutMs = opts.wallClockTimeoutMs ?? 200_000;
  try {
    const { object } = await withTimeout(
      generateObject({
        model: nicheBendModel,
        system: SYSTEM_PROMPT,
        messages,
        schema,
        maxOutputTokens: Math.min(opts.maxOutputTokens, CLAUDE_MAX_OUTPUT_TOKENS),
      }),
      wallClockTimeoutMs,
      `Claude took too long to respond (over ${Math.round(wallClockTimeoutMs / 1000)}s). Try again.`
    );
    return {
      object: object as z.infer<Schema>,
      messages: [...messages, { role: "assistant", content: JSON.stringify(object) }],
    };
  } catch (error) {
    wrapProviderError(error);
  }
}

const VideoSchema = z.object({ title: z.string(), views: z.string() });

const ChannelAnalysisSchema = z.object({
  channelName: z.string(),
  detectedNiche: z.string(),
  format: z.string(),
  topVideos: z.array(VideoSchema),
});

const CandidateSchema = z.object({
  nicheName: z.string(),
  angle: z.enum(["Ranking", "Timeline", "Conflict"]),
  exampleTitles: z.array(z.string()),
});

const AnalysisAndCandidatesSchema = z.object({
  analysis: ChannelAnalysisSchema,
  candidates: z.array(CandidateSchema),
});

const HookFormulaSchema = z.object({
  template: z.string(),
  usedInVideos: z.array(z.string()),
  psychology: z.string(),
  whenToUse: z.string(),
  forYourChannelExamples: z.array(z.string()),
});

const ScriptBeatSchema = z.object({
  beat: z.string(),
  timing: z.string(),
  function: z.string(),
});

const StorytellingFrameworkSchema = z.object({
  name: z.string(),
  howItWorks: z.string(),
  usedInVideos: z.array(z.string()),
  steps: z.array(z.string()),
  signaturePhrases: z.array(z.string()),
  yourChannelMoat: z.string(),
});

const RehookSchema = z.object({
  phrase: z.string(),
  whenToUse: z.string(),
});

const RetentionMechanicsSchema = z.object({
  rehookCatalog: z.array(RehookSchema),
  patternInterrupts: z.array(z.string()),
  openLoopsRule: z.string(),
  specificitySpikesRule: z.string(),
  specificityExamples: z.array(z.string()),
});

const OpeningClosingSchema = z.object({
  first30SecondsTemplate: z.array(z.string()),
  hardRules: z.array(z.string()),
  howVideosEnd: z.string(),
  signatureClosingPhrases: z.array(z.string()),
});

const QuickReferenceCardSchema = z.object({
  hookFormulaPicks: z.array(z.string()),
  beatStructureOneLine: z.string(),
  topRehooks: z.array(z.string()),
  dos: z.array(z.string()),
  donts: z.array(z.string()),
});

const ChannelOverviewSchema = z.object({
  channel: z.string(),
  niche: z.string(),
  format: z.string(),
  narrationPov: z.string(),
  avgLength: z.string(),
  recurringThemes: z.array(z.string()),
  yourChannelNote: z.string(),
});

// Split across two structured-output calls: a single schema covering the
// whole SOP compiles to a constrained-decoding grammar large enough to hit
// the model's structured-output/grammar limits.
const SopPartASchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  onelinePromise: z.string(),
  channelOverview: ChannelOverviewSchema,
  hookPlaybook: z.array(HookFormulaSchema),
  scriptStructureBeats: z.array(ScriptBeatSchema),
});

const SopPartBSchema = z.object({
  storytellingFrameworks: z.array(StorytellingFrameworkSchema),
  retentionMechanics: RetentionMechanicsSchema,
  openingClosingPatterns: OpeningClosingSchema,
  quickReferenceCard: QuickReferenceCardSchema,
});

function candidatesFromParsed(
  candidates: z.infer<typeof CandidateSchema>[]
): NicheBendCandidate[] {
  return candidates.slice(0, 3).map((candidate, index) => ({
    id: (index + 1) as 1 | 2 | 3,
    nicheName: candidate.nicheName,
    angle: candidate.angle,
    exampleTitles: candidate.exampleTitles,
  }));
}

interface ResearchOutcome {
  analysis: NicheBendChannelAnalysis;
  candidates: NicheBendCandidate[];
  conversation: ModelMessage[];
}

const CandidatesOnlySchema = z.object({ candidates: z.array(CandidateSchema) });

const CandidateOnlySchema = z.object({ candidate: CandidateSchema });

export async function regenerateOneCandidate(
  conversation: ModelMessage[],
  analysis: NicheBendChannelAnalysis,
  otherCandidates: NicheBendCandidate[]
): Promise<{ candidate: NicheBendCandidate; conversation: ModelMessage[] }> {
  const avoidList = [analysis.detectedNiche, ...otherCandidates.map((c) => c.nicheName)].join(", ");
  const prompt = `Give exactly 1 NEW strategic "niche bend" candidate for this same channel — a different niche than any of these: ${avoidList}. Same format: nicheName (max 3 words), angle (Ranking, Timeline, or Conflict), and exactly 3 example titles in that new niche, in the channel's real hook style. Respond only in the required structured format.`;

  const messages: ModelMessage[] = [...conversation, { role: "user", content: prompt }];
  const { object, messages: nextMessages } = await runExtract(messages, CandidateOnlySchema, {
    maxOutputTokens: 1000,
    wallClockTimeoutMs: 90_000,
  });

  return {
    candidate: {
      id: 1,
      nicheName: object.candidate.nicheName,
      angle: object.candidate.angle,
      exampleTitles: object.candidate.exampleTitles,
    },
    conversation: nextMessages,
  };
}

export async function regenerateCandidates(
  conversation: ModelMessage[],
  analysis: NicheBendChannelAnalysis
): Promise<{ candidates: NicheBendCandidate[]; conversation: ModelMessage[] }> {
  const prompt = `Give 3 NEW strategic "niche bend" candidates for this same channel — different niches than any you've already proposed earlier in this conversation, and still different from the channel's own detected niche ("${analysis.detectedNiche}"). Same format: nicheName (max 3 words), angle (Ranking, Timeline, or Conflict), and exactly 3 example titles in that new niche, in the channel's real hook style. Respond only in the required structured format.`;

  const messages: ModelMessage[] = [...conversation, { role: "user", content: prompt }];
  const { object, messages: nextMessages } = await runExtract(messages, CandidatesOnlySchema, {
    maxOutputTokens: 2000,
    wallClockTimeoutMs: 120_000,
  });

  return {
    candidates: candidatesFromParsed(object.candidates),
    conversation: nextMessages,
  };
}

async function extractAnalysisAndCandidates(
  conversation: ModelMessage[],
  platform: NicheBendPlatform,
  extractionPrompt: string,
  avatarUrl?: string
): Promise<ResearchOutcome> {
  const messages: ModelMessage[] = [...conversation, { role: "user", content: extractionPrompt }];

  const { object, messages: nextMessages } = await runExtract(messages, AnalysisAndCandidatesSchema, {
    maxOutputTokens: 8000,
    wallClockTimeoutMs: 300_000,
  });

  const analysis: NicheBendChannelAnalysis = {
    channelName: object.analysis.channelName,
    platform,
    avatarUrl,
    detectedNiche: object.analysis.detectedNiche,
    format: object.analysis.format,
    topVideos: object.analysis.topVideos,
  };

  return {
    analysis,
    candidates: candidatesFromParsed(object.candidates),
    conversation: nextMessages,
  };
}

export async function researchChannel(
  url: string,
  platform: NicheBendPlatform,
  videoType: NicheBendVideoType
): Promise<ResearchOutcome> {
  const platformLabel = platform === "youtube" ? "YouTube" : "TikTok";
  const formatLabel = videoType === "shorts" ? "Shorts / short-form vertical videos" : "long-form videos";

  let scraped;
  try {
    scraped = await scrapeChannelVideos(url, platform, videoType);
  } catch (error) {
    if (error instanceof ApifyScraperError) {
      throw new NicheBendAiError(error.message);
    }
    // Anything else (a bug, an unexpected throw from a dependency) still has
    // to cross this boundary as a NicheBendAiError — it's the only error type
    // job-store's humanizeError() recognizes as "clean". Letting a raw error
    // through here is what produces the generic, unhelpful failure message.
    const message = error instanceof Error ? error.message : String(error);
    throw new NicheBendAiError(`Could not scrape that channel: ${message}`);
  }

  const videoList = scraped.videos.map((video) => `- ${video.title} — ${video.views} views`).join("\n");

  const extractionPrompt = `We scraped the real top ${formatLabel} from the ${platformLabel} channel "${scraped.channelName}" (${url}), sorted by view count:

${videoList}

From this real data, produce:
1. A structured channel analysis: channelName ("${scraped.channelName}"), detectedNiche, format (one paragraph — length range if inferable, narration POV if inferable, recurring structural/thematic patterns across these titles), and topVideos (echo the videos given, exactly).
2. Exactly 3 strategic "niche bend" candidates: each applies this exact channel's proven format to a DIFFERENT vertical/niche than the one you detected for the channel itself. Each candidate needs: a bold niche name (max 3 words), an angle tag — exactly one of Ranking, Timeline, or Conflict — describing the narrative shape, and exactly 3 example video titles in that new niche, written in the same hook style as this channel's real top-video titles.

Respond only in the required structured format.`;

  return extractAnalysisAndCandidates([], platform, extractionPrompt, scraped.avatarUrl);
}

export async function researchFromManualVideos(
  url: string | undefined,
  platform: NicheBendPlatform,
  videoType: NicheBendVideoType,
  manualVideos: NicheBendVideo[]
): Promise<ResearchOutcome> {
  const platformLabel = platform === "youtube" ? "YouTube" : "TikTok";
  const formatLabel = videoType === "shorts" ? "Shorts / short-form vertical videos" : "long-form videos";
  const videoList = manualVideos.map((video) => `- ${video.title} — ${video.views} views`).join("\n");

  const prompt = `A creator pasted their own top ${platformLabel} video titles and view counts below (no web research needed or possible — work only from this data). These are ${formatLabel}.

${videoList}

From only this data, infer and produce:
1. A structured channel analysis: channelName (use "${url ? url : "Your channel"}" or infer a reasonable label if a URL was given), detectedNiche, format (one paragraph — length range if inferable, narration POV if inferable, recurring structural/thematic patterns across these titles), and topVideos (echo the videos given, exactly).
2. Exactly 3 strategic "niche bend" candidates applying the same proven format to 3 different verticals than the detected niche. Each with a niche name (max 3 words), an angle tag (Ranking, Timeline, or Conflict), and exactly 3 example titles in that new niche, in the same hook style as the given titles.

Respond only in the required structured format.`;

  return extractAnalysisAndCandidates([], platform, prompt);
}

export async function generateSopContent(
  conversation: ModelMessage[],
  analysis: NicheBendChannelAnalysis,
  chosenBend: NicheBendCandidate
): Promise<NicheBendSopContent> {
  const groundingRule = `Ground everything in the real videos you found or were given earlier — cite specific source videos by their actual titles wherever you make a claim (in every "usedInVideos" field, reference real titles, not placeholders like "Video 1"). Do not invent details unrelated to the real channel.`;

  const baseConversation: ModelMessage[] =
    conversation.length > 0
      ? conversation
      : [
          {
            role: "user",
            content: `Channel analysis on record: ${JSON.stringify(analysis)}`,
          },
        ];

  const promptA = `The user has chosen to bend this channel into: ${chosenBend.nicheName} (${chosenBend.angle} angle).

Write the first half of the Scripting SOP now. ${groundingRule}

Header — title: "${analysis.channelName} — Scripting SOP". subtitle: a one-line description of who this SOP is prepared for and the target niche/format. onelinePromise: one sentence stating this SOP reverse-engineers ${analysis.channelName}'s scripting formula, noting every pattern below appeared in multiple of the real videos.

1. Channel Overview — channel, niche, format (with length range), narrationPov, avgLength, recurringThemes (list), yourChannelNote (how the ${chosenBend.nicheName} bend creates a competitive moat).

2. Hook Playbook — 2 to 4 REAL hook formulas actually used by this channel. Each needs: a fill-in-the-blank template, usedInVideos (real titles), psychology (why it works in the first 2 seconds), whenToUse, and forYourChannelExamples (1-2 rewritten examples in the ${chosenBend.nicheName} niche).

3. Script Structure Blueprint (scriptStructureBeats) — the beat structure actually used (4-6 beats), each with a beat name, a timing range, and a fill-in-the-blank function template.

Respond only in the required structured format.`;

  const messagesA: ModelMessage[] = [...baseConversation, { role: "user", content: promptA }];

  const { object: parsedA, messages: messagesAfterA } = await runExtract(messagesA, SopPartASchema, {
    maxOutputTokens: 12000,
    wallClockTimeoutMs: 300_000,
  });

  const promptB = `Now write the second half of the same Scripting SOP for ${chosenBend.nicheName}. ${groundingRule}

4. Storytelling Frameworks — 2 to 4 named frameworks actually used, each with howItWorks, usedInVideos (real titles), a numbered steps sequence, signaturePhrases, and yourChannelMoat.

5. Retention Mechanics — rehookCatalog (signature phrases to steal verbatim, each with whenToUse), patternInterrupts (recurring tension devices), openLoopsRule, specificitySpikesRule + specificityExamples (real examples: exact numbers, names, places from the videos).

6. Opening & Closing Patterns — first30SecondsTemplate (sentence by sentence, S1-S4), hardRules, howVideosEnd, signatureClosingPhrases.

7. Quick Reference Card — hookFormulaPicks, beatStructureOneLine, topRehooks (top 5), dos, donts.

Respond only in the required structured format.`;

  const messagesB: ModelMessage[] = [...messagesAfterA, { role: "user", content: promptB }];

  const { object: parsedB } = await runExtract(messagesB, SopPartBSchema, {
    maxOutputTokens: 16000,
    wallClockTimeoutMs: 350_000,
  });

  return { ...parsedA, ...parsedB };
}
