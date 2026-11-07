import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { clipMomentsFallbackModel, clipMomentsModel } from "@/lib/server/openrouter-client";
import { hasArabicScript, type ClipMoment, type TranscriptWord } from "@/lib/clips";

// Moroccan Darija captions are written the way Moroccans text it, in Latin
// letters ("SALAM ALIKOM ANA SMITI SAAD"), not in Arabic script. WhisperX
// writes Darija in Arabic script, so once the moments are picked, each
// clip's words (plus the editor's stretch room) are romanized by the LLM,
// one batch per clip in parallel and word for word, so every word keeps its
// timing. A batch the model gets wrong falls back to a letter mapping.

// The editor lets a trim stretch 8s past the clip (SOURCE_MARGIN_SECONDS).
const MARGIN_SECONDS = 10;
const BATCH_WORDS = 160;
const REQUEST_TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT = `You romanize Moroccan Darija for short-form video captions, the way Moroccans write Darija in Latin letters on TikTok and Instagram.

You get numbered words from a speech transcript in Arabic script. Return "words" with exactly one entry per input word, in the same order: that word in Latin letters, as a Moroccan says it.
- Letters only, never digits for sounds: ع is "a", ح is "h", خ is "kh", غ is "gh", ق is "q", ش is "ch", ج is "j". Examples: السلام عليكم أنا سميتي سعد -> "salam" "alikom" "ana" "smiti" "saad"; واش -> "wach"; ديال -> "dyal"; بزاف -> "bzaf"; كنبغيك -> "kanbghik"; مزيان -> "mzyan"; شنو -> "chno".
- French, Spanish or English words written in Arabic script get their usual spelling back (بون -> "bon", طوموبيل -> "tomobil").
- Words already in Latin letters, and numbers, stay as they are.
- One entry per input word: never merge, split, skip or translate words.
- Lowercase, no punctuation.`;

const RomanizedSchema = z.object({ words: z.array(z.string()) });

// As moments.ts and the editor's wordKey match words.
const bare = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

const LETTERS: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "a",
  ٱ: "a",
  ب: "b",
  ت: "t",
  ث: "t",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "d",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "ch",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "d",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ة: "a",
  ى: "a",
  ء: "",
  ئ: "i",
  ؤ: "o",
  گ: "g",
  ڭ: "g",
  ڨ: "g",
  ڤ: "v",
  پ: "p",
};
const PUNCTUATION: Record<string, string> = {
  "،": ",",
  "؟": "?",
  "؛": ";",
  "۔": ".",
  ".": ".",
  ",": ",",
  "!": "!",
  "?": "?",
};

/** The word's closing punctuation in Latin form: caption grouping breaks on it. */
function closingPunctuation(word: string): string {
  const match = word.match(/[.,!?،؟؛۔]+$/);
  return match ? [...match[0]].map((ch) => PUNCTUATION[ch] ?? "").join("") : "";
}

/** A rough letter-by-letter romanization, for when the model can't be used. */
export function romanizeLetters(word: string): string {
  const letters = [...word.replace(/[ً-ٰٟـ]/g, "")];
  let out = "";
  letters.forEach((ch, i) => {
    const digit = "٠١٢٣٤٥٦٧٨٩".indexOf(ch);
    if (digit >= 0) out += digit;
    else if (ch === "و") out += i === 0 ? "w" : i === letters.length - 1 ? "o" : "ou";
    else if (ch === "ي") out += i === 0 ? "y" : "i";
    else if (ch in LETTERS) out += LETTERS[ch];
    else if (/[\p{L}\p{N}']/u.test(ch) && !hasArabicScript(ch)) out += ch.toLowerCase();
  });
  // The article runs into the word in speech: السلام is "salam", not "alslam".
  return out.replace(/^al(?=[^aeiou]{2})/, "").replace(/^al(?=\w{3})/, "l");
}

// Chat-alphabet digits written inside words (m3a, 7na, 3lach): 3 is ع, 7 is ح, 9 is ق...
const ARABIZI_DIGITS: Record<string, string> = { 2: "", 3: "a", 5: "kh", 7: "h", 8: "gh", 9: "q" };
const DIGIT_AS_LETTER = /(?<!\d)[235789](?!\d)/g;
const lettersForDigits = (word: string) =>
  /[a-z]/i.test(word) ? word.replace(DIGIT_AS_LETTER, (d) => ARABIZI_DIGITS[d]) : word;

/** The model's spelling, tidied: Arabizi digits become letters; anything unusable falls back. */
function cleanSpelling(raw: string, original: string): string {
  let word = lettersForDigits(raw.normalize("NFKC").toLowerCase().trim());
  word = word
    .replace(/[^\p{L}\p{N}' -]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!word || hasArabicScript(word)) word = romanizeLetters(original);
  return word + closingPunctuation(original);
}

async function romanizeBatch(list: string[]): Promise<string[]> {
  const prompt = `Romanize these ${list.length} words. Return exactly ${list.length} entries.\n\n${list
    .map((word, i) => `${i + 1}. ${word}`)
    .join("\n")}`;
  for (const model of [clipMomentsModel, clipMomentsFallbackModel]) {
    try {
      const { object } = await generateObject({
        model,
        system: SYSTEM_PROMPT,
        prompt,
        schema: RomanizedSchema,
        maxOutputTokens: 4000,
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (object.words.length === list.length) return object.words.map((word, i) => cleanSpelling(word, list[i]));
      console.error(`[clips/darija] model returned ${object.words.length} words for ${list.length}`);
    } catch (error) {
      console.error("[clips/darija] romanizing failed:", error);
    }
  }
  return list.map((word) => cleanSpelling("", word));
}

/**
 * Latin spellings for the Arabic-script words around each clip, by index
 * into `words`. Words already in Latin letters are left out (kept as said).
 */
export async function romanizeDarija(
  words: TranscriptWord[],
  clips: Pick<ClipMoment, "start" | "end">[]
): Promise<Map<number, string>> {
  // Each clip's span with its stretch room; overlapping spans merged.
  const spans: [number, number][] = [];
  for (const clip of [...clips].sort((a, b) => a.start - b.start)) {
    const span: [number, number] = [clip.start - MARGIN_SECONDS, clip.end + MARGIN_SECONDS];
    const last = spans[spans.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else spans.push(span);
  }

  const batches: number[][] = [];
  for (const [from, to] of spans) {
    const indices = words.flatMap((w, i) => (w[1] > from && w[0] < to && hasArabicScript(w[2]) ? [i] : []));
    const count = Math.ceil(indices.length / BATCH_WORDS);
    const size = Math.ceil(indices.length / Math.max(1, count));
    for (let i = 0; i < indices.length; i += size) batches.push(indices.slice(i, i + size));
  }

  const spellings = await Promise.all(batches.map((batch) => romanizeBatch(batch.map((i) => words[i][2]))));
  const latin = new Map<number, string>();
  batches.forEach((batch, b) => batch.forEach((index, k) => latin.set(index, spellings[b][k])));
  return latin;
}

/** Titles and captions in plain Latin letters: no Arabizi digits, and any Arabic-script word mapped letter by letter. */
function latinCopy(text: string): string {
  return text
    .split(/(\s+)/)
    .map((token) =>
      hasArabicScript(token) ? romanizeLetters(token) + closingPunctuation(token) : lettersForDigits(token)
    )
    .join("");
}

/**
 * A clip moved to the Latin spellings its captions now show: keywords,
 * emoji words and opening words, plus the model's titles and caption.
 */
export function romanizeClip(clip: ClipMoment, words: TranscriptWord[], latin: Map<number, string>): ClipMoment {
  const spellings = new Map<string, Set<string>>();
  const opening: string[] = [];
  words.forEach((w, i) => {
    if (w[0] < clip.start || w[1] > clip.end) return;
    const to = latin.get(i) ?? w[2];
    opening.push(to);
    const key = bare(w[2]);
    if (!spellings.has(key)) spellings.set(key, new Set());
    spellings.get(key)!.add(bare(to));
  });
  // A word the model spelled two ways in one clip matches both.
  const spelled = (word: string) => [...(spellings.get(word) ?? [word])].filter(Boolean);
  return {
    ...clip,
    title: latinCopy(clip.title),
    hookTitle: latinCopy(clip.hookTitle),
    caption: latinCopy(clip.caption),
    hashtags: clip.hashtags.map((tag) => latinCopy(tag).replace(/[^\p{L}\p{N}_]/gu, "")).filter(Boolean),
    keywords: [...new Set(clip.keywords.flatMap(spelled))].slice(0, 10),
    emojis: clip.emojis.flatMap((pair) =>
      spelled(pair.word)
        .slice(0, 1)
        .map((word) => ({ ...pair, word }))
    ),
    hook: opening.slice(0, Math.max(1, clip.hook.split(/\s+/).filter(Boolean).length)).join(" "),
  };
}
