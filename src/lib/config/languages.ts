// Language catalog for the Voiceover Generator -- the `language_code` enum
// accepted by Replicate's google/gemini-3.1-flash-tts (same live-verification
// discipline as voices.ts: confirmed against
// https://replicate.com/google/gemini-3.1-flash-tts/api/schema). Labels are
// Intl.DisplayNames-derived, sorted alphabetically for a picker rather than
// kept in the API's original order.

export interface LanguageOption {
  /** Gemini TTS `language_code` enum value, sent verbatim. */
  code: string;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "af-ZA", label: "Afrikaans (South Africa)" },
  { code: "sq-AL", label: "Albanian (Albania)" },
  { code: "am-ET", label: "Amharic (Ethiopia)" },
  { code: "ar-EG", label: "Arabic (Egypt)" },
  { code: "ar-001", label: "Arabic (Standard)" },
  { code: "hy-AM", label: "Armenian (Armenia)" },
  { code: "az-AZ", label: "Azerbaijani (Azerbaijan)" },
  { code: "bn-BD", label: "Bangla (Bangladesh)" },
  { code: "eu-ES", label: "Basque (Spain)" },
  { code: "be-BY", label: "Belarusian (Belarus)" },
  { code: "bg-BG", label: "Bulgarian (Bulgaria)" },
  { code: "my-MM", label: "Burmese (Myanmar)" },
  { code: "ca-ES", label: "Catalan (Spain)" },
  { code: "ceb-PH", label: "Cebuano (Philippines)" },
  { code: "cmn-CN", label: "Chinese (China)" },
  { code: "cmn-tw", label: "Chinese (Taiwan)" },
  { code: "hr-HR", label: "Croatian (Croatia)" },
  { code: "cs-CZ", label: "Czech (Czechia)" },
  { code: "da-DK", label: "Danish (Denmark)" },
  { code: "nl-NL", label: "Dutch (Netherlands)" },
  { code: "en-AU", label: "English (Australia)" },
  { code: "en-IN", label: "English (India)" },
  { code: "en-GB", label: "English (United Kingdom)" },
  { code: "en-US", label: "English (United States)" },
  { code: "et-EE", label: "Estonian (Estonia)" },
  { code: "fil-PH", label: "Filipino (Philippines)" },
  { code: "fi-FI", label: "Finnish (Finland)" },
  { code: "fr-CA", label: "French (Canada)" },
  { code: "fr-FR", label: "French (France)" },
  { code: "gl-ES", label: "Galician (Spain)" },
  { code: "ka-GE", label: "Georgian (Georgia)" },
  { code: "de-DE", label: "German (Germany)" },
  { code: "el-GR", label: "Greek (Greece)" },
  { code: "gu-IN", label: "Gujarati (India)" },
  { code: "ht-HT", label: "Haitian Creole (Haiti)" },
  { code: "he-IL", label: "Hebrew (Israel)" },
  { code: "hi-IN", label: "Hindi (India)" },
  { code: "hu-HU", label: "Hungarian (Hungary)" },
  { code: "is-IS", label: "Icelandic (Iceland)" },
  { code: "id-ID", label: "Indonesian (Indonesia)" },
  { code: "it-IT", label: "Italian (Italy)" },
  { code: "ja-JP", label: "Japanese (Japan)" },
  { code: "jv-JV", label: "Javanese" },
  { code: "kn-IN", label: "Kannada (India)" },
  { code: "kok-IN", label: "Konkani (India)" },
  { code: "ko-KR", label: "Korean (South Korea)" },
  { code: "lo-LA", label: "Lao (Laos)" },
  { code: "la-VA", label: "Latin (Vatican City)" },
  { code: "lv-LV", label: "Latvian (Latvia)" },
  { code: "lt-LT", label: "Lithuanian (Lithuania)" },
  { code: "lb-LU", label: "Luxembourgish (Luxembourg)" },
  { code: "mk-MK", label: "Macedonian (North Macedonia)" },
  { code: "mai-IN", label: "Maithili (India)" },
  { code: "mg-MG", label: "Malagasy (Madagascar)" },
  { code: "ms-MY", label: "Malay (Malaysia)" },
  { code: "ml-IN", label: "Malayalam (India)" },
  { code: "mr-IN", label: "Marathi (India)" },
  { code: "mn-MN", label: "Mongolian (Mongolia)" },
  { code: "ne-NP", label: "Nepali (Nepal)" },
  { code: "nb-NO", label: "Norwegian Bokmål (Norway)" },
  { code: "nn-NO", label: "Norwegian Nynorsk (Norway)" },
  { code: "or-IN", label: "Odia (India)" },
  { code: "ps-AF", label: "Pashto (Afghanistan)" },
  { code: "fa-IR", label: "Persian (Iran)" },
  { code: "pl-PL", label: "Polish (Poland)" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "pt-PT", label: "Portuguese (Portugal)" },
  { code: "pa-IN", label: "Punjabi (India)" },
  { code: "ro-RO", label: "Romanian (Romania)" },
  { code: "ru-RU", label: "Russian (Russia)" },
  { code: "sr-RS", label: "Serbian (Serbia)" },
  { code: "sd-IN", label: "Sindhi (India)" },
  { code: "si-LK", label: "Sinhala (Sri Lanka)" },
  { code: "sk-SK", label: "Slovak (Slovakia)" },
  { code: "sl-SI", label: "Slovenian (Slovenia)" },
  { code: "es-419", label: "Spanish (Latin America)" },
  { code: "es-MX", label: "Spanish (Mexico)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "sw-KE", label: "Swahili (Kenya)" },
  { code: "sv-SE", label: "Swedish (Sweden)" },
  { code: "ta-IN", label: "Tamil (India)" },
  { code: "te-IN", label: "Telugu (India)" },
  { code: "th-TH", label: "Thai (Thailand)" },
  { code: "tr-TR", label: "Turkish (Türkiye)" },
  { code: "uk-UA", label: "Ukrainian (Ukraine)" },
  { code: "ur-PK", label: "Urdu (Pakistan)" },
  { code: "vi-VN", label: "Vietnamese (Vietnam)" },
];

export const DEFAULT_LANGUAGE_CODE = "en-US";

export function getLanguageOption(code: string): LanguageOption | undefined {
  return LANGUAGE_OPTIONS.find((language) => language.code === code);
}
