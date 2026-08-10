import { franc } from "franc-min";

// Below this many characters, neither the script check nor franc's trigram
// model has enough signal to trust -- default to keeping the video rather
// than risk dropping a real short title in the target language.
const MIN_CHARS_FOR_FRANC = 30;

// Unicode letter ranges that never occur in Latin-script languages (Arabic/Urdu,
// Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada,
// Malayalam, Thai, Georgian, Cyrillic, Greek, Japanese/Chinese, Korean) --
// if a meaningful share of a title's letters fall in one of these, it isn't
// French/German/English/etc, independent of what a trigram model would guess.
const NON_LATIN_LETTERS =
  /[؀-ۿݐ-ݿऀ-ॿঀ-৿਀-੿઀-૿଀-୿஀-௿ఀ-౿ಀ-೿ഀ-ൿ฀-๿Ⴀ-ჿЀ-ӿͰ-Ͽ぀-ヿ㐀-鿿가-힯]/g;
const LATIN_LETTERS = /[A-Za-z]/g;

// Script ranges for the non-Latin-script languages reachable via the country
// filter's language map (see COUNTRY_LANGUAGE in youtube-client.ts). Unlike
// Latin-script languages -- where "not non-Latin" is a good enough proxy --
// these need a positive match, since e.g. a French title and a Japanese
// title both equally fail a "no non-Latin script" check.
const SCRIPT_RANGES: Record<string, RegExp> = {
  jpn: /[぀-ヿ㐀-鿿]/g,
  kor: /[가-힯]/g,
  hin: /[ऀ-ॿ]/g,
};

function stripNoise(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#]\w+/g, " ")
    .trim();
}

/**
 * Best-effort "is this in `targetLang` (an ISO 639-3 code, e.g. 'eng',
 * 'fra')" check for short, noisy social captions. Non-Latin-script targets
 * (jpn/kor/hin) use a positive script-ratio match; Latin-script targets use
 * a script check to rule out non-Latin text outright, then franc's trigram
 * model to tell Latin-script languages apart (a script check alone can't
 * distinguish French from English or Spanish). Short or letterless text
 * defaults to "matches" -- the goal is filtering out clearly wrong-language
 * content, not risking false negatives on real short titles.
 */
export function isTextInLanguage(rawText: string, targetLang: string): boolean {
  const text = stripNoise(rawText);
  if (!text) return true;

  const scriptRange = SCRIPT_RANGES[targetLang];
  if (scriptRange) {
    const targetScript = text.match(scriptRange)?.length ?? 0;
    const nonLatin = text.match(NON_LATIN_LETTERS)?.length ?? 0;
    const latin = text.match(LATIN_LETTERS)?.length ?? 0;
    const total = nonLatin + latin;
    if (total < 6) return true;
    return targetScript / total > 0.3;
  }

  const nonLatin = text.match(NON_LATIN_LETTERS)?.length ?? 0;
  const latin = text.match(LATIN_LETTERS)?.length ?? 0;
  if (nonLatin + latin === 0) return true;
  if (nonLatin / (nonLatin + latin) > 0.15) return false;

  if (text.length < MIN_CHARS_FOR_FRANC) return true;

  const detected = franc(text, { minLength: MIN_CHARS_FOR_FRANC });
  return detected === targetLang || detected === "und";
}

export function isEnglishText(rawText: string): boolean {
  return isTextInLanguage(rawText, "eng");
}

export function filterEnglishOnly<T extends { title: string }>(items: T[]): T[] {
  return items.filter((item) => isEnglishText(item.title));
}

export function filterByLanguage<T extends { title: string }>(items: T[], targetLang: string): T[] {
  return items.filter((item) => isTextInLanguage(item.title, targetLang));
}
