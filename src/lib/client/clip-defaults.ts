import { ALL_LAYOUTS } from "@/lib/client/clip-layouts";
import { wordKey, type ClipEditSettings } from "@/lib/client/clip-render";
import type { ClipMoment } from "@/lib/clips";

// A clip's starting edit settings. Pure (no React, no fetching) so the
// render worker's page bundle can use it as well as the editor.

/** A clip's starting settings; an Arabic one (`rtl`) captions and titles in Montserrat Arabic. */
export function defaultSettings(clip: ClipMoment, rtl = false): ClipEditSettings {
  // The hook starts with up to two of the clip's keywords highlighted.
  const keywords = new Set((clip.keywords ?? []).map(wordKey));
  const hookWords = (clip.hookTitle ?? "").split(/\s+/).map(wordKey);
  return {
    start: clip.start,
    end: clip.end,
    aspect: "9:16",
    // Auto: the AI reads the footage and picks the layout, until the user picks one.
    layouts: [...ALL_LAYOUTS],
    bottomVideo: false,
    reframe: "auto",
    camera: "smooth",
    zoom: "auto",
    focusX: 0.5,
    panX: 0,
    captions: "hormozi",
    // Auto: the middle on gameplay, screen and split clips, low on the rest.
    captionPosition: "auto",
    captionX: 0.5,
    captionY: 0.72,
    captionFont: rtl ? "arabic" : "auto",
    captionSize: 1,
    captionWords: 0,
    captionColor: "auto",
    emojis: true,
    hookTitle: Boolean(clip.hookTitle),
    hookText: clip.hookTitle ?? "",
    hookStyle: "card",
    hookFont: rtl ? "arabic" : "sauce",
    hookSize: 1,
    hookPosition: "top",
    hookX: 0.5,
    hookY: 0.17,
    hookEmphasis: [...new Set(hookWords.filter((word) => word && keywords.has(word)))].slice(0, 2),
    hookColor: "auto",
    hookMotion: "pop",
    hookUpper: false,
    hookSeconds: 3,
    removePauses: false,
    title: clip.title,
  };
}
