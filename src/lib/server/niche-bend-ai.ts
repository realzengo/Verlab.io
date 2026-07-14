import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { anthropic, NICHE_BEND_MODEL } from "./anthropic-client";
import type {
  NicheBendCandidate,
  NicheBendChannelAnalysis,
  NicheBendPlatform,
  NicheBendSopContent,
  NicheBendVideo,
  NicheBendVideoType,
} from "@/lib/types";

type MessageParam = Anthropic.Messages.MessageParam;
type ContentBlockParam = Anthropic.Messages.ContentBlockParam;

export class NicheBendAiError extends Error {}

const SYSTEM_PROMPT = `You are Clypa's niche-bending strategist: an expert short-form video (YouTube/TikTok) scripting analyst. You reverse-engineer what makes a channel's videos work — hooks, structure, pacing, retention devices — and you write precise, actionable playbooks other creators can execute from. You are terse, concrete, and evidence-based: every claim you make must be grounded in real videos from the channel you're analyzing, and you cite which specific videos support it. No hype, no vague advice, no generic content-creator platitudes.`;

const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20260209 = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 6,
};

function systemBlocks(): Anthropic.Messages.TextBlockParam[] {
  return [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
  ];
}

function toContentBlockParams(content: Anthropic.Messages.ContentBlock[]): ContentBlockParam[] {
  return content as unknown as ContentBlockParam[];
}

type MessageWithParsedOutput = Anthropic.Messages.Message & { parsed_output?: unknown };

async function runStream(
  messages: MessageParam[],
  opts: {
    maxTokens: number;
    format?: Anthropic.Messages.JSONOutputFormat;
    effort?: "high" | "xhigh";
    wallClockTimeoutMs?: number;
    includeSearchTool?: boolean;
  }
): Promise<MessageWithParsedOutput> {
  // Structured output formats compile to a constrained-decoding grammar;
  // combining a large schema with an additional strict tool (web_search) can
  // exceed Claude's compiled-grammar size limit ("Simplify your tool schemas
  // or reduce the number of strict tools"). Calls that don't need to search
  // again (they're just formatting/writing from prior context) omit the tool.
  const includeSearchTool = opts.includeSearchTool ?? true;

  const stream = anthropic.messages.stream({
    model: NICHE_BEND_MODEL,
    max_tokens: opts.maxTokens,
    thinking: { type: "adaptive" },
    output_config: {
      effort: opts.effort ?? "high",
      format: opts.format,
    },
    system: systemBlocks(),
    ...(includeSearchTool ? { tools: [WEB_SEARCH_TOOL] } : {}),
    messages,
  });

  // The SDK's per-request `timeout` resets on every received chunk (it's an
  // idle timeout, not a wall-clock cap), so a request that keeps streaming
  // search rounds can run indefinitely. Enforce a hard wall-clock ceiling
  // ourselves and abort the stream if it's exceeded.
  const wallClockTimeoutMs = opts.wallClockTimeoutMs ?? 240_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      stream.abort();
      reject(new NicheBendAiError(`Claude took too long to respond (over ${Math.round(wallClockTimeoutMs / 1000)}s). Try again.`));
    }, wallClockTimeoutMs);
  });

  try {
    return await Promise.race([stream.finalMessage(), timeout]);
  } catch (error) {
    if (error instanceof NicheBendAiError) {
      throw error;
    }
    if (error instanceof Anthropic.APIError) {
      throw new NicheBendAiError(`Claude request failed: ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
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
// Claude's "compiled grammar is too large" limit.
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
  conversation: MessageParam[];
}

const CandidatesOnlySchema = z.object({ candidates: z.array(CandidateSchema) });

export async function regenerateCandidates(
  conversation: MessageParam[],
  analysis: NicheBendChannelAnalysis
): Promise<{ candidates: NicheBendCandidate[]; conversation: MessageParam[] }> {
  const prompt = `Give 3 NEW strategic "niche bend" candidates for this same channel — different niches than any you've already proposed earlier in this conversation, and still different from the channel's own detected niche ("${analysis.detectedNiche}"). Same format: nicheName (max 3 words), angle (Ranking, Timeline, or Conflict), and exactly 3 example titles in that new niche, in the channel's real hook style. Respond only in the required structured format.`;

  const messages: MessageParam[] = [...conversation, { role: "user", content: prompt }];
  const message = await runStream(messages, {
    maxTokens: 2000,
    format: zodOutputFormat(CandidatesOnlySchema),
    wallClockTimeoutMs: 120_000,
  });
  const parsed = message.parsed_output as z.infer<typeof CandidatesOnlySchema> | undefined;
  if (!parsed) {
    throw new NicheBendAiError("Claude did not return new candidates.");
  }

  return {
    candidates: candidatesFromParsed(parsed.candidates),
    conversation: [...messages, { role: "assistant", content: toContentBlockParams(message.content) }],
  };
}

async function extractAnalysisAndCandidates(
  conversation: MessageParam[],
  platform: NicheBendPlatform,
  extractionPrompt: string
): Promise<ResearchOutcome> {
  const messages: MessageParam[] = [...conversation, { role: "user", content: extractionPrompt }];

  const message = await runStream(messages, {
    maxTokens: 8000,
    format: zodOutputFormat(AnalysisAndCandidatesSchema),
    wallClockTimeoutMs: 200_000,
  });

  const parsed = message.parsed_output as z.infer<typeof AnalysisAndCandidatesSchema> | undefined;
  if (!parsed) {
    throw new NicheBendAiError("Claude did not return a structured channel analysis.");
  }

  const analysis: NicheBendChannelAnalysis = {
    channelName: parsed.analysis.channelName,
    platform,
    detectedNiche: parsed.analysis.detectedNiche,
    format: parsed.analysis.format,
    topVideos: parsed.analysis.topVideos,
  };

  return {
    analysis,
    candidates: candidatesFromParsed(parsed.candidates),
    conversation: [...messages, { role: "assistant", content: toContentBlockParams(message.content) }],
  };
}

export async function researchChannel(
  url: string,
  platform: NicheBendPlatform,
  videoType: NicheBendVideoType
): Promise<ResearchOutcome> {
  const platformLabel = platform === "youtube" ? "YouTube" : "TikTok";
  const formatLabel = videoType === "shorts" ? "Shorts / short-form vertical videos" : "long-form videos";

  const researchPrompt = `Research the ${platformLabel} channel at this URL using web search: ${url}

This channel primarily posts ${formatLabel}.

Find:
1. The channel's actual name/handle.
2. Its most-viewed videos (aim for 10) — for each, the exact title and view count if you can find it (search results, thumbnails, third-party stats sites, etc.). If you can't confirm an exact view count, give your best estimate and say it's an estimate rather than inventing false precision.
3. The niche/topic category this channel covers.
4. The proven scripting format: video length range, narration point of view (first person / narrator / voiceover-only / etc.), and recurring structural or thematic patterns across the top videos.

Use at most 4-5 searches — be efficient, don't exhaustively re-search. Do not fabricate video titles or view counts. If the channel is hard to find or has very few view-count signals available, say so plainly. End with a clear plain-text summary of everything you found.`;

  const message = await runStream([{ role: "user", content: researchPrompt }], {
    maxTokens: 6000,
    wallClockTimeoutMs: 240_000,
  });

  const conversation: MessageParam[] = [
    { role: "user", content: researchPrompt },
    { role: "assistant", content: toContentBlockParams(message.content) },
  ];

  const extractionPrompt = `Based on your research above, produce:

1. A structured channel analysis (channelName, detectedNiche, format — one paragraph covering length range, narration POV, and recurring themes — and topVideos: the real top videos you found, titled, with view counts as strings like "4.2M" or "~4.2M" if estimated).
2. Exactly 3 strategic "niche bend" candidates: each applies this exact channel's proven format to a DIFFERENT vertical/niche than the one you detected for the channel itself. Each candidate needs: a bold niche name (max 3 words), an angle tag — exactly one of Ranking, Timeline, or Conflict — describing the narrative shape, and exactly 3 example video titles in that new niche, written in the same hook style as this channel's real top-video titles.

Respond only in the required structured format.`;

  return extractAnalysisAndCandidates(conversation, platform, extractionPrompt);
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
2. Exactly 3 strategic "niche bend" candidates applying the same proven format to 3 different verticals than the detected niche — each with a niche name (max 3 words), an angle tag (Ranking, Timeline, or Conflict), and exactly 3 example titles in that new niche, in the same hook style as the given titles.

Respond only in the required structured format.`;

  return extractAnalysisAndCandidates([], platform, prompt);
}

export async function generateSopContent(
  conversation: MessageParam[],
  analysis: NicheBendChannelAnalysis,
  chosenBend: NicheBendCandidate
): Promise<NicheBendSopContent> {
  const groundingRule = `Ground everything in the real videos you found or were given earlier — cite specific source videos by their actual titles wherever you make a claim (in every "usedInVideos" field, reference real titles, not placeholders like "Video 1"). Do not invent details unrelated to the real channel.`;

  const baseConversation: MessageParam[] =
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

  const messagesA: MessageParam[] = [...baseConversation, { role: "user", content: promptA }];

  const messageA = await runStream(messagesA, {
    maxTokens: 12000,
    effort: "xhigh",
    format: zodOutputFormat(SopPartASchema),
    wallClockTimeoutMs: 200_000,
    includeSearchTool: false,
  });

  const parsedA = messageA.parsed_output as z.infer<typeof SopPartASchema> | undefined;
  if (!parsedA) {
    throw new NicheBendAiError("Claude did not return the first half of the structured SOP.");
  }

  const messagesAfterA: MessageParam[] = [
    ...messagesA,
    { role: "assistant", content: toContentBlockParams(messageA.content) },
  ];

  const promptB = `Now write the second half of the same Scripting SOP for ${chosenBend.nicheName}. ${groundingRule}

4. Storytelling Frameworks — 2 to 4 named frameworks actually used, each with howItWorks, usedInVideos (real titles), a numbered steps sequence, signaturePhrases, and yourChannelMoat.

5. Retention Mechanics — rehookCatalog (signature phrases to steal verbatim, each with whenToUse), patternInterrupts (recurring tension devices), openLoopsRule, specificitySpikesRule + specificityExamples (real examples: exact numbers, names, places from the videos).

6. Opening & Closing Patterns — first30SecondsTemplate (sentence by sentence, S1-S4), hardRules, howVideosEnd, signatureClosingPhrases.

7. Quick Reference Card — hookFormulaPicks, beatStructureOneLine, topRehooks (top 5), dos, donts.

Respond only in the required structured format.`;

  const messagesB: MessageParam[] = [...messagesAfterA, { role: "user", content: promptB }];

  const messageB = await runStream(messagesB, {
    maxTokens: 16000,
    effort: "xhigh",
    format: zodOutputFormat(SopPartBSchema),
    wallClockTimeoutMs: 220_000,
    includeSearchTool: false,
  });

  const parsedB = messageB.parsed_output as z.infer<typeof SopPartBSchema> | undefined;
  if (!parsedB) {
    throw new NicheBendAiError("Claude did not return the second half of the structured SOP.");
  }

  return { ...parsedA, ...parsedB };
}
