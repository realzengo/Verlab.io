import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { clipMomentsFallbackModel, clipMomentsModel } from "@/lib/server/openrouter-client";
import {
  CLIP_LENGTHS,
  formatClock,
  isRtlText,
  type ClipMoment,
  type ClipOptions,
  type TranscriptWord,
} from "@/lib/clips";

// Picks the viral moments of a long-form video from its timed transcript
// (the "AI-Youtube-Shorts-Generator" highlight step), then snaps each pick to
// real word boundaries so no clip opens or closes mid-word. Beyond the range,
// each pick carries what the editor needs to dress the clip the way OpusClip
// does: a hook headline, a score breakdown, caption keywords and emojis.

const MIN_CLIP_SECONDS = 10;
const MAX_CLIP_SECONDS = 95;
const MIN_SCORE = 50;
const REQUEST_TIMEOUT_MS = 150_000;

// The model's answer time grows with what it writes (~340 output tokens a
// clip), so a long transcript is split into parts read in parallel: an hour
// as 4 parts of 4 clips each comes back in about the time one call takes to
// write 4, instead of 12 (~20s instead of ~70s). The parts overlap by more
// than the longest clip, so a moment on a seam lies whole inside one of
// them; if both pick it, the overlap check below keeps the better one.
const SINGLE_PART_MAX_SECONDS = 20 * 60;
const PART_SECONDS = 15 * 60;
const MAX_PARTS = 8;
const PART_OVERLAP_SECONDS = 100;

const MomentsSchema = z.object({
  moroccan_darija: z.boolean(),
  clips: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      title: z.string(),
      hook_title: z.string(),
      hook: z.string(),
      score: z.number(),
      hook_score: z.number(),
      flow_score: z.number(),
      value_score: z.number(),
      trend_score: z.number(),
      reason: z.string(),
      keywords: z.array(z.string()),
      emojis: z.array(z.object({ word: z.string(), emoji: z.string() })),
      caption: z.string(),
      hashtags: z.array(z.string()),
    })
  ),
});

const SYSTEM_PROMPT = `You are a senior short-form video editor who turns long YouTube videos into TikTok, Reels and Shorts clips that hold attention.

You get a timed transcript: each line starts with its start time in seconds, in brackets. Pick the strongest standalone moments.

Rules for every clip:
- Respect the length range you are given. Use the bracketed times: "start" is the time of the line the clip opens on, "end" is the time just after its last line is spoken (the next line's start time).
- Self-contained: a viewer who never saw the video understands it and gets a payoff.
- Opens on a hook: a bold claim, a question, a surprising fact, a punchline setup, a conflict, or an emotional peak. Never open mid-sentence or on filler ("so", "um", "anyway").
- Ends right after the payoff, on a complete sentence.
- Clips never overlap. Spread them across the whole video when the material allows.
- Prefer stakes, humor, conflict, strong opinions, surprising information, practical advice and emotional moments. Skip intros, sponsor reads, outros and housekeeping.

Fields:
- score: an honest 0-100 rating of how well the clip works on its own. 90+ would likely go viral, 75-89 is strong, 60-74 is decent. Don't return clips under 60.
- hook_score, flow_score, value_score, trend_score: honest 0-100 sub-scores. Hook: how hard the first 3 seconds stop the scroll. Flow: how cleanly it plays start to finish without needing context. Value: how much the viewer gets (laugh, insight, emotion, information). Trend: how well the topic fits what performs on short-form right now.
- title: at most 60 characters, curiosity-driven but true to the clip. Used as the post title and file name.
- hook_title: 3 to 8 punchy words shown on screen over the first seconds, like "He lost everything in 24 hours". No emojis, no quotes.
- hook: the clip's exact opening words from the transcript, at most 12 words.
- reason: one short sentence on why it works.
- keywords: 4 to 10 single words spoken in the clip that carry its meaning (names, numbers, strong verbs, punchlines), exactly as they appear in the transcript.
- emojis: 2 to 5 pairs of a single word spoken in the clip (exactly as in the transcript) and one emoji that fits it.
- caption: a ready-to-post caption, at most 150 characters, no hashtags.
- hashtags: 3 to 5 lowercase tags without the "#".
Write title, hook_title, caption and hashtags in the transcript's language.
- moroccan_darija: true only when the speakers mainly speak Moroccan Darija (Moroccan Arabic), not Standard Arabic or another dialect. When true, write title, hook_title, caption and hashtags in Darija with Latin letters, the way Moroccans write it online, never digits for sounds (like "salam alikom ana smiti saad"). keywords, emoji words and hook still copy the transcript exactly.
Return the clips sorted by score, best first.`;

/** Groups words into transcript lines: sentence ends, long pauses, or ~25 words. */
type TranscriptLine = { start: number; text: string };

function transcriptLines(words: TranscriptWord[]): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  let current: TranscriptWord[] = [];
  const flush = () => {
    if (!current.length) return;
    lines.push({ start: current[0][0], text: current.map((w) => w[2]).join(" ") });
    current = [];
  };
  words.forEach((word, index) => {
    const next = words[index + 1];
    current.push(word);
    const sentenceEnd = /[.!?…؟]["')\]]?$/.test(word[2]);
    const pause = next ? next[0] - word[1] > 1.2 : false;
    if (sentenceEnd || pause || current.length >= 25) flush();
  });
  flush();
  return lines;
}

interface TranscriptPart {
  from: number;
  to: number;
  lines: TranscriptLine[];
}

/** The transcript as one part, or as overlapping parts for a long video. */
function transcriptParts(lines: TranscriptLine[], durationSeconds: number): TranscriptPart[] {
  const count =
    durationSeconds <= SINGLE_PART_MAX_SECONDS ? 1 : Math.min(MAX_PARTS, Math.ceil(durationSeconds / PART_SECONDS));
  const size = durationSeconds / count;
  return Array.from({ length: count }, (_, index) => {
    const from = index === 0 ? 0 : index * size - PART_OVERLAP_SECONDS;
    const last = index === count - 1;
    const to = last ? durationSeconds : (index + 1) * size;
    return { from, to, lines: lines.filter((line) => line.start >= from && (last || line.start < to)) };
  }).filter((part) => part.lines.length > 0);
}

function targetClipCount(durationSeconds: number, options: ClipOptions): number {
  const perClip = options.length === "short" ? 120 : options.length === "long" ? 240 : 180;
  return Math.min(12, Math.max(4, Math.round(durationSeconds / perClip)));
}

const round = (value: number) => Math.round(value * 100) / 100;
const clampScore = (value: number) => Math.round(Math.min(99, Math.max(0, Number.isFinite(value) ? value : 0)));

/**
 * Snaps a picked range onto word boundaries: the first word starting at or
 * after (start - 0.4s) and the last word ending at or before (end + 0.6s).
 */
function snapToWords(words: TranscriptWord[], start: number, end: number): { start: number; end: number } | null {
  const first = words.findIndex((w) => w[0] >= start - 0.4);
  if (first === -1) return null;
  let last = first;
  for (let i = first; i < words.length && words[i][1] <= end + 0.6; i++) last = i;
  // A little air on both sides so the first syllable and the last word's
  // tail aren't clipped by the cut.
  return { start: round(Math.max(0, words[first][0] - 0.15)), end: round(words[last][1] + 0.35) };
}

const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

const bare = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

// One grapheme that's actually an emoji, not a word the model slipped in.
const EMOJI = /^\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*$/u;

export class ClipMomentsError extends Error {}

async function askModel(system: string, prompt: string) {
  const call = (model: typeof clipMomentsModel) =>
    generateObject({
      model,
      system,
      prompt,
      schema: MomentsSchema,
      maxOutputTokens: 12000,
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  try {
    return (await call(clipMomentsModel)).object;
  } catch (error) {
    console.error("[clips/moments] primary model failed, falling back:", error);
    return (await call(clipMomentsFallbackModel)).object;
  }
}

/** Whether a transcript is mostly in Arabic script (a sample of it). */
function isArabicTranscript(words: TranscriptWord[]): boolean {
  const step = Math.max(1, Math.floor(words.length / 600));
  return isRtlText(
    words
      .filter((_, i) => i % step === 0)
      .map((w) => w[2])
      .join(" ")
  );
}

export async function findViralMoments(input: {
  title: string;
  channelTitle: string | null;
  durationSeconds: number;
  words: TranscriptWord[];
  options: ClipOptions;
}): Promise<{ clips: ClipMoment[]; darija: boolean }> {
  const lines = transcriptLines(input.words);
  if (lines.length < 5) {
    throw new ClipMomentsError("There isn't enough speech in this video to find clips.");
  }

  const count = targetClipCount(input.durationSeconds, input.options);
  const [minLength, maxLength] = CLIP_LENGTHS.find((option) => option.value === input.options.length)!.range;
  const parts = transcriptParts(lines, input.durationSeconds);
  // A few more than an even share, so the strongest parts can carry more of the final picks.
  const perPart = parts.length === 1 ? count : Math.min(count, Math.ceil(count / parts.length) + 1);
  const briefFor = (part: TranscriptPart, index: number) =>
    [
      `Video: "${input.title}"${input.channelTitle ? ` by ${input.channelTitle}` : ""}, ${Math.round(input.durationSeconds / 60)} minutes.`,
      parts.length > 1
        ? `This is part ${index + 1} of ${parts.length} of its transcript, from ${formatClock(part.from)} to ${formatClock(part.to)}; the other parts are handled separately.`
        : null,
      `Each clip must be ${minLength} to ${maxLength} seconds long.`,
      input.options.focus
        ? `The creator wants clips about: "${input.options.focus}". Prefer moments that match; only fill the rest with the strongest other moments.`
        : null,
      `Return ${perPart} clips; return fewer only if the ${parts.length > 1 ? "part" : "video"} truly lacks that many standalone moments.`,
    ]
      .filter(Boolean)
      .join("\n");

  const results = await Promise.allSettled(
    parts.map((part, index) =>
      askModel(
        SYSTEM_PROMPT,
        `${briefFor(part, index)}\n\nTranscript:\n${part.lines.map((line) => `[${line.start.toFixed(1)}] ${line.text}`).join("\n")}`
      )
    )
  );
  const answers = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  // A part that failed on both models only costs its own clips.
  if (!answers.length) throw failures[0].reason;
  if (failures.length) console.error(`[clips/moments] ${failures.length} of ${parts.length} parts failed:`, failures[0].reason);
  const rawClips = answers.flatMap((answer) => answer.clips);
  const darijaVotes = answers.filter((answer) => answer.moroccan_darija === true).length;

  const picked: ClipMoment[] = [];
  for (const raw of rawClips.sort((a, b) => b.score - a.score)) {
    if (!Number.isFinite(raw.start) || !Number.isFinite(raw.end) || raw.end <= raw.start) continue;
    const range = snapToWords(input.words, Math.max(0, raw.start), Math.min(input.durationSeconds, raw.end));
    if (!range) continue;
    const length = range.end - range.start;
    if (length < Math.min(MIN_CLIP_SECONDS, minLength) || length > Math.min(MAX_CLIP_SECONDS, maxLength + 10)) continue;
    if (picked.some((p) => overlap(p, range) > 0.3 * Math.min(length, p.end - p.start))) continue;
    const score = clampScore(raw.score);
    if (score < MIN_SCORE) continue;

    // Keywords and emoji words only count if they're really said in the clip.
    const spoken = new Set(input.words.filter((w) => w[0] >= range.start && w[1] <= range.end).map((w) => bare(w[2])));
    const keywords = [...new Set(raw.keywords.map(bare))].filter((word) => word && spoken.has(word)).slice(0, 10);
    const emojis = raw.emojis
      .map((pair) => ({ word: bare(pair.word), emoji: pair.emoji.trim() }))
      .filter((pair) => pair.word && spoken.has(pair.word) && EMOJI.test(pair.emoji))
      .slice(0, 5);

    picked.push({
      id: "",
      ...range,
      title: raw.title.trim().slice(0, 80),
      hookTitle: raw.hook_title.replace(/["“”]/g, "").trim().split(/\s+/).slice(0, 10).join(" "),
      hook: raw.hook.trim().split(/\s+/).slice(0, 12).join(" "),
      score,
      scores: {
        hook: clampScore(raw.hook_score),
        flow: clampScore(raw.flow_score),
        value: clampScore(raw.value_score),
        trend: clampScore(raw.trend_score),
      },
      reason: raw.reason.trim().slice(0, 240),
      keywords,
      emojis,
      caption: raw.caption.trim().slice(0, 220),
      hashtags: raw.hashtags
        .map((tag) => tag.replace(/^#/, "").replace(/\s+/g, "").toLowerCase())
        .filter(Boolean)
        .slice(0, 5),
    });
    if (picked.length >= count) break;
  }

  if (!picked.length) {
    throw new ClipMomentsError("We couldn't find a strong standalone moment in this video.");
  }

  // The strip reads left to right through the video, like the timeline.
  const clips = picked.sort((a, b) => a.start - b.start).map((clip, index) => ({ ...clip, id: `c${index + 1}` }));
  // Darija captions get romanized; the flag only counts for a transcript in Arabic script.
  return { clips, darija: darijaVotes * 2 >= answers.length && isArabicTranscript(input.words) };
}
