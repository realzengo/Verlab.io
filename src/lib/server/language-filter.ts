import { franc } from "franc-min";

// Below this many characters, neither the script check nor franc's trigram
// model has enough signal to trust -- default to keeping the video rather
// than risk dropping a real short English title ("Crime scene", "Unbelievable").
const MIN_CHARS_FOR_FRANC = 30;

// Unicode letter ranges that never occur in English text (Arabic/Urdu,
// Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada,
// Malayalam, Thai, Georgian, Cyrillic, Greek, Japanese/Chinese, Korean) --
// if a meaningful share of a title's letters fall in one of these, it's not
// English, independent of what a trigram model on the rest would guess.
const NON_LATIN_LETTERS =
  /[؀-ۿݐ-ݿऀ-ॿঀ-৿਀-੿઀-૿଀-୿஀-௿ఀ-౿ಀ-೿ഀ-ൿ฀-๿Ⴀ-ჿЀ-ӿͰ-Ͽ぀-ヿ㐀-鿿가-힯]/g;
const LATIN_LETTERS = /[A-Za-z]/g;

function stripNoise(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#]\w+/g, " ")
    .trim();
}

/**
 * Best-effort "is this English" check for short, noisy social captions.
 * Two-stage: a script check (cheap, deterministic, no false positives on
 * real English text) catches non-Latin-script languages outright; franc's
 * trigram model only gets a vote on longer Latin-script text, where a script
 * check alone can't tell English apart from e.g. Spanish or romanized Hindi.
 * Short or letterless text defaults to English -- the goal is filtering out
 * clearly non-English content, not risking false positives on real titles.
 */
export function isEnglishText(rawText: string): boolean {
  const text = stripNoise(rawText);
  if (!text) return true;

  const nonLatin = text.match(NON_LATIN_LETTERS)?.length ?? 0;
  const latin = text.match(LATIN_LETTERS)?.length ?? 0;
  if (nonLatin + latin === 0) return true;
  if (nonLatin / (nonLatin + latin) > 0.15) return false;

  if (text.length < MIN_CHARS_FOR_FRANC) return true;

  const detected = franc(text, { minLength: MIN_CHARS_FOR_FRANC });
  return detected === "eng" || detected === "und";
}

export function filterEnglishOnly<T extends { title: string }>(items: T[]): T[] {
  return items.filter((item) => isEnglishText(item.title));
}
