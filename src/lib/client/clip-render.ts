// Turns a cut of the source video into a finished short, entirely in the
// browser (WebCodecs via Mediabunny; the server has no ffmpeg). One painter
// draws every frame -- the editor's live preview and the export run the same
// code, so what the user sees is what they download.
//
// What a frame can carry: an AI-reframed crop (or fit-with-blur, or a
// split screen over a background video), word-timed captions in one of
// twelve templates (six animated word-by-word, six classic) with a chosen
// font, size, words per screen, highlight color, keyword colors and emojis,
// and a hook headline in one of four looks. The export can also cut out
// pauses and filler words (jump cuts).

import {
  LAYOUT_PANELS,
  layoutPlan,
  sceneAt,
  type LayoutId,
  type LayoutPlan,
  type PanelCrop,
  type SceneFrame,
} from "@/lib/client/clip-layouts";
import { cameraPath, centerAt, type CameraMode, type ReframeTrack } from "@/lib/client/clip-reframe";
import {
  CLIP_EXPORT_MAX_BYTES,
  hasArabicScript,
  isRtlText,
  type ClipAspect,
  type ClipEmoji,
  type TranscriptWord,
} from "@/lib/clips";
import { SEGMENT_ALL, SEGMENT_FRAME, SEGMENT_HEADER_BYTES } from "@/lib/clip-segments";

export type CaptionTemplate =
  | "pop"
  | "drop"
  | "slide"
  | "reveal"
  | "aurora"
  | "deep"
  | "karaoke"
  | "beast"
  | "hormozi"
  | "clean"
  | "neon"
  | "minimal"
  | "off";
export type CaptionPosition = "top" | "middle" | "bottom" | "custom";
export type CaptionFont = "sauce" | "montserrat" | "poppins" | "inter" | "anton" | "bebas" | "luckiest" | "arabic";
export type HookStyle = "card" | "dark" | "outline" | "brand";
/** How the hook comes in: pops, drops and bounces, fades, or word by word. */
export type HookMotion = "pop" | "drop" | "fade" | "words";

export interface ClipEditSettings {
  /** Seconds on the source timeline. */
  start: number;
  end: number;
  aspect: ClipAspect;
  /** The layouts the AI may pick per shot (one = always that one). */
  layouts: LayoutId[];
  /** Crayo-style split: the clip on top, an uploaded video below. Overrides the layouts. */
  bottomVideo: boolean;
  /** "auto" follows faces and picks layouts (AI); "manual" is a Fill crop at focusX. */
  reframe: "auto" | "manual";
  /** How the AI camera moves: operator-style holds and pans, or continuous follow. */
  camera: CameraMode;
  /** Horizontal position of the crop in manual mode, 0 (left) to 1 (right). */
  focusX: number;
  captions: CaptionTemplate;
  /** Top, Middle and Bottom sit where suits the layout; "custom" pins the captions at captionX/captionY. */
  captionPosition: CaptionPosition;
  /** The captions' center as a fraction of the frame (0-1), when the position is "custom". */
  captionX: number;
  captionY: number;
  /** The template's own font, or another. */
  captionFont: CaptionFont | "auto";
  /** Multiplies the template's size. */
  captionSize: number;
  /** Words on screen at once; 0 lets the template decide. */
  captionWords: number;
  /** Replaces the template's highlight color; "auto" keeps it. */
  captionColor: string;
  emojis: boolean;
  /** The hook headline: over the first seconds, or above the video in "fit". */
  hookTitle: boolean;
  hookText: string;
  hookStyle: HookStyle;
  hookFont: CaptionFont;
  hookSize: number;
  /** Top sits where suits the layout (in Fit, a headline over the video); "custom" pins it at hookX/hookY. */
  hookPosition: CaptionPosition;
  /** The hook's center as a fraction of the frame (0-1), when its position is "custom". */
  hookX: number;
  hookY: number;
  /** The hook's highlighted words, as wordKey()s. */
  hookEmphasis: string[];
  /** The highlight color; "auto" picks one that reads on the look. */
  hookColor: string;
  hookMotion: HookMotion;
  /** All capitals, whatever was typed. */
  hookUpper: boolean;
  /** How long the hook stays, in seconds; 0 keeps it for the whole clip. */
  hookSeconds: number;
  /** Jump cuts: drop pauses and filler words. */
  removePauses: boolean;
  /** Post title and file name. */
  title: string;
}

export interface CaptionChunk {
  start: number;
  end: number;
  words: TranscriptWord[];
}

/** Everything the painter needs to caption one clip, computed once per settings change. */
export interface CaptionData {
  chunks: CaptionChunk[];
  keywords: Set<string>;
  emojis: Map<string, string>;
}

export interface ClipSource {
  blob: Blob;
  /** Source time (seconds) at 0 in `blob`. */
  offset: number;
}

export class ClipRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClipRenderError";
  }
}

export const OUTPUT_SIZES: Record<ClipAspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};

/**
 * Caption and hook typefaces, loaded as web fonts by the editor. `scale`
 * evens out how big each one reads at the same size (condensed faces run
 * small); `weights` are the ones actually loaded. Montserrat Arabic is also
 * every font's fallback, so Arabic words never drop to a system face.
 */
export const CAPTION_FONTS: Record<CaptionFont, { label: string; family: string; weights: number[]; scale: number }> = {
  sauce: { label: "Open Sauce", family: '"Open Sauce One"', weights: [600, 700, 800, 900], scale: 1 },
  montserrat: { label: "Montserrat", family: '"Montserrat"', weights: [700, 800, 900], scale: 1 },
  poppins: { label: "Poppins", family: '"Poppins"', weights: [700, 800, 900], scale: 0.98 },
  inter: { label: "Inter", family: '"Inter"', weights: [700, 800, 900], scale: 1 },
  anton: { label: "Anton", family: '"Anton"', weights: [400], scale: 1.12 },
  bebas: { label: "Bebas Neue", family: '"Bebas Neue"', weights: [400], scale: 1.24 },
  luckiest: { label: "Luckiest Guy", family: '"Luckiest Guy"', weights: [400], scale: 1.22 },
  arabic: { label: "Montserrat Arabic", family: '"Montserrat Arabic"', weights: [600, 700, 800, 900], scale: 1 },
};

/** Roughly where the hook presets put its center; Top moves with the layout. */
export const HOOK_PRESET_Y: Record<Exclude<CaptionPosition, "custom">, number> = {
  top: 0.17,
  middle: 0.5,
  bottom: 0.74,
};

/** Where the presets put captions over a Fill frame; other layouts move them to suit. */
export const CAPTION_PRESET_Y: Record<Exclude<CaptionPosition, "custom">, number> = {
  top: 0.24,
  middle: 0.5,
  bottom: 0.72,
};

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const POP_SECONDS = 0.12;
const OUTPUT_FPS = 30;

/** A canvas font string at the loaded weight nearest to `weight`. */
function fontSpec(id: CaptionFont, weight: number, px: number): string {
  const font = CAPTION_FONTS[id];
  const w = font.weights.reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a));
  return `${w} ${px}px ${font.family}, ${CAPTION_FONTS.arabic.family}, system-ui, sans-serif`;
}

interface TemplateStyle {
  label: string;
  font: CaptionFont;
  maxWords: number;
  maxChars: number;
  weight: number;
  size: number;
  upper: boolean;
  fill: string;
  stroke?: { color: string; width: number };
  shadow?: { color: string; blur: number; dy: number };
  /** The word being spoken. */
  active?: { fill?: string; scale?: number; box?: string };
  /** Keyword colors, cycled. */
  keyword?: string[];
  glow?: string;
  pill?: boolean;
  dimUnspoken?: boolean;
  /**
   * How words arrive: the whole group pops in (default), or each word as it's
   * spoken springs in with an overshoot, drops in with a bounce, or rises in.
   */
  motion?: "group" | "spring" | "drop" | "rise";
  /** A highlight box that glides from word to word. */
  slide?: string;
  /** Fill gradient along each line. */
  gradient?: string[];
  /** Extruded 3D depth under the letters. */
  depth?: { color: string; layers: number };
}

export const CAPTION_TEMPLATES: Record<Exclude<CaptionTemplate, "off">, TemplateStyle> = {
  // Animated, CapCut / After Effects style.
  pop: {
    label: "Pop",
    font: "montserrat",
    maxWords: 1,
    maxChars: 99,
    weight: 900,
    size: 112,
    upper: true,
    fill: "#FFFFFF",
    stroke: { color: "#000000", width: 16 },
    shadow: { color: "rgba(0,0,0,0.55)", blur: 0, dy: 8 },
    keyword: ["#FFE14D", "#4ADE80"],
    motion: "spring",
  },
  drop: {
    label: "Drop",
    font: "anton",
    maxWords: 3,
    maxChars: 16,
    weight: 400,
    size: 92,
    upper: true,
    fill: "#FFFFFF",
    stroke: { color: "#000000", width: 12 },
    shadow: { color: "rgba(0,0,0,0.6)", blur: 0, dy: 7 },
    active: { fill: "#FFE14D" },
    motion: "drop",
  },
  slide: {
    label: "Slide",
    font: "poppins",
    maxWords: 3,
    maxChars: 18,
    weight: 800,
    size: 76,
    upper: false,
    fill: "#FFFFFF",
    shadow: { color: "rgba(0,0,0,0.55)", blur: 12, dy: 3 },
    slide: "#335CFF",
  },
  reveal: {
    label: "Reveal",
    font: "inter",
    maxWords: 5,
    maxChars: 26,
    weight: 800,
    size: 68,
    upper: false,
    fill: "#FFFFFF",
    stroke: { color: "rgba(0,0,0,0.6)", width: 7 },
    shadow: { color: "rgba(0,0,0,0.6)", blur: 16, dy: 3 },
    active: { fill: "#FFE14D" },
    motion: "rise",
  },
  aurora: {
    label: "Aurora",
    font: "poppins",
    maxWords: 3,
    maxChars: 18,
    weight: 800,
    size: 86,
    upper: true,
    fill: "#FFFFFF",
    stroke: { color: "#1A1033", width: 9 },
    gradient: ["#7DD3FC", "#A78BFA", "#F472B6"],
    glow: "#A78BFA",
    active: { fill: "#FFFFFF" },
    dimUnspoken: true,
  },
  deep: {
    label: "Deep",
    font: "montserrat",
    maxWords: 2,
    maxChars: 14,
    weight: 900,
    size: 100,
    upper: true,
    fill: "#FFFFFF",
    stroke: { color: "#111827", width: 6 },
    depth: { color: "#111827", layers: 9 },
    active: { fill: "#FFE14D", scale: 1.08 },
    keyword: ["#4ADE80"],
  },
  // Classic.
  karaoke: {
    label: "Karaoke",
    font: "sauce",
    maxWords: 3,
    maxChars: 18,
    weight: 900,
    size: 80,
    upper: true,
    fill: "#FFFFFF",
    stroke: { color: "#000000", width: 12 },
    active: { box: "#335CFF" },
  },
  beast: {
    label: "Beast",
    font: "sauce",
    maxWords: 2,
    maxChars: 14,
    weight: 900,
    size: 98,
    upper: true,
    fill: "#FFFFFF",
    stroke: { color: "#000000", width: 18 },
    shadow: { color: "rgba(0,0,0,0.9)", blur: 0, dy: 9 },
    active: { scale: 1.14 },
    keyword: ["#FFE14D", "#4ADE80", "#FF5C5C"],
  },
  hormozi: {
    label: "Hormozi",
    font: "sauce",
    maxWords: 3,
    maxChars: 18,
    weight: 900,
    size: 84,
    upper: true,
    fill: "#FFFFFF",
    stroke: { color: "#000000", width: 13 },
    active: { fill: "#FFE14D" },
    keyword: ["#4ADE80"],
  },
  clean: {
    label: "Clean",
    font: "sauce",
    maxWords: 4,
    maxChars: 24,
    weight: 700,
    size: 58,
    upper: false,
    fill: "#FFFFFF",
    pill: true,
  },
  neon: {
    label: "Neon",
    font: "sauce",
    maxWords: 3,
    maxChars: 18,
    weight: 800,
    size: 80,
    upper: true,
    fill: "#FFFFFF",
    glow: "#22D3EE",
    active: { fill: "#F472B6" },
  },
  minimal: {
    label: "Minimal",
    font: "sauce",
    maxWords: 7,
    maxChars: 34,
    weight: 600,
    size: 52,
    upper: false,
    fill: "#FFFFFF",
    shadow: { color: "rgba(0,0,0,0.75)", blur: 14, dy: 2 },
    dimUnspoken: true,
  },
};

/** Whether a highlight color does anything for this template. */
export function captionTakesColor(template: CaptionTemplate): boolean {
  if (template === "off") return false;
  const style = CAPTION_TEMPLATES[template];
  return Boolean(style.active?.fill || style.active?.box || style.keyword || style.slide || style.glow);
}

/** The template with its highlight color swapped for `color`. */
function withAccent(style: TemplateStyle, color: string): TemplateStyle {
  if (!color || color === "auto") return style;
  return {
    ...style,
    active: style.active && {
      ...style.active,
      ...(style.active.fill && style.active.fill !== "#FFFFFF" ? { fill: color } : {}),
      ...(style.active.box ? { box: color } : {}),
    },
    keyword: style.keyword && [color],
    slide: style.slide && color,
    glow: style.glow && color,
  };
}

/** Fonts a clip's captions and hook draw with, to load before painting (the Arabic one when Arabic is on screen). */
export function fontsFor(
  settings: Pick<
    ClipEditSettings,
    "start" | "end" | "captions" | "captionFont" | "hookFont" | "hookTitle" | "hookText"
  >,
  words: TranscriptWord[] = []
): CaptionFont[] {
  const fonts = new Set<CaptionFont>(["sauce"]);
  if (settings.captions !== "off") {
    fonts.add(settings.captionFont === "auto" ? CAPTION_TEMPLATES[settings.captions].font : settings.captionFont);
    if (words.some((w) => w[1] > settings.start && w[0] < settings.end && hasArabicScript(w[2]))) fonts.add("arabic");
  }
  if (settings.hookTitle) {
    fonts.add(settings.hookFont);
    if (hasArabicScript(settings.hookText)) fonts.add("arabic");
  }
  return [...fonts];
}

/** Whether a clip reads right to left: its words are mostly Arabic script. */
export function isRtlClip(words: TranscriptWord[], start: number, end: number): boolean {
  return isRtlText(
    words
      .filter((w) => w[1] > start && w[0] < end)
      .map((w) => w[2])
      .join(" ")
  );
}

/** Whether the bottom-video split applies (it can't in landscape). */
const usesBottomVideo = (settings: Pick<ClipEditSettings, "aspect" | "bottomVideo">) =>
  settings.bottomVideo && settings.aspect !== "16:9";

/** Width / height of the crop the AI camera moves across in Fill. */
export function cropAspectFor(settings: Pick<ClipEditSettings, "aspect" | "bottomVideo">): number {
  const { width, height } = OUTPUT_SIZES[settings.aspect];
  return usesBottomVideo(settings) ? width / (height / 2) : width / height;
}

/** Whether the clip's look depends on face tracking (so the export waits for it). */
export function usesTracking(settings: Pick<ClipEditSettings, "aspect" | "reframe" | "layouts">): boolean {
  return (
    settings.reframe === "auto" &&
    settings.aspect !== "16:9" &&
    !(settings.layouts.length === 1 && settings.layouts[0] === "fit")
  );
}

/** The AI layout plan for a clip, or null when its settings don't use one. */
export function planFor(
  track: ReframeTrack | null | undefined,
  settings: Pick<ClipEditSettings, "aspect" | "reframe" | "layouts" | "camera" | "bottomVideo">
): LayoutPlan | null {
  if (!track || settings.reframe !== "auto" || settings.aspect === "16:9" || usesBottomVideo(settings)) return null;
  const { width, height } = OUTPUT_SIZES[settings.aspect];
  return layoutPlan(track, { layouts: settings.layouts, outputAspect: width / height, camera: settings.camera });
}

const bare = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
/** A word as keywords, emojis and hook highlights match it: lowercase, without punctuation. */
export const wordKey = bare;

/** Splits the clip's words into the groups shown one at a time. */
export function captionChunks(
  words: TranscriptWord[],
  start: number,
  end: number,
  template: CaptionTemplate = "hormozi",
  wordsAtOnce = 0
): CaptionChunk[] {
  const style = CAPTION_TEMPLATES[template === "off" ? "hormozi" : template];
  const maxWords = wordsAtOnce > 0 ? wordsAtOnce : style.maxWords;
  const maxChars =
    wordsAtOnce === 1 ? Infinity : wordsAtOnce > 0 ? Math.max(style.maxChars, wordsAtOnce * 8) : style.maxChars;
  const inRange = words.filter((w) => w[1] > start && w[0] < end);
  const chunks: CaptionChunk[] = [];
  let current: TranscriptWord[] = [];
  inRange.forEach((word, index) => {
    current.push(word);
    const next = inRange[index + 1];
    const chars = current.reduce((sum, w) => sum + w[2].length + 1, 0);
    if (
      !next ||
      /[.,!?;:…،؛؟]["')\]]?$/.test(word[2]) ||
      current.length >= maxWords ||
      chars >= maxChars ||
      next[0] - word[1] > 0.35
    ) {
      chunks.push({ start: current[0][0], end: word[1], words: current });
      current = [];
    }
  });
  // Each group stays up until the next one starts, or briefly after its last word.
  return chunks.map((chunk, index) => ({
    ...chunk,
    end: Math.min(chunks[index + 1]?.start ?? Infinity, chunk.end + 0.5),
  }));
}

export function prepareCaptions(
  words: TranscriptWord[],
  settings: Pick<ClipEditSettings, "start" | "end" | "captions" | "captionWords">,
  clip: { keywords?: string[]; emojis?: ClipEmoji[] }
): CaptionData {
  return {
    chunks: captionChunks(words, settings.start, settings.end, settings.captions, settings.captionWords),
    keywords: new Set((clip.keywords ?? []).map(bare)),
    emojis: new Map((clip.emojis ?? []).map((pair) => [bare(pair.word), pair.emoji])),
  };
}

const FILLERS = new Set(["um", "uh", "uhm", "umm", "erm", "er", "ah", "hmm", "mm", "mhm"]);
const PAUSE_SECONDS = 0.45;
const PAD_SECONDS = 0.1;

/**
 * The parts of [start, end] to keep (source time). With removePauses, gaps
 * longer than PAUSE_SECONDS and filler words are cut, leaving a little air
 * so words aren't clipped.
 */
export function keepRanges(
  words: TranscriptWord[],
  start: number,
  end: number,
  removePauses: boolean
): [number, number][] {
  if (!removePauses) return [[start, end]];
  const speech = words.filter((w) => w[1] > start && w[0] < end && !FILLERS.has(bare(w[2])));
  if (!speech.length) return [[start, end]];
  const ranges: [number, number][] = [];
  let rangeStart = Math.max(start, speech[0][0] - PAD_SECONDS);
  for (let i = 0; i < speech.length - 1; i++) {
    const gapStart = speech[i][1];
    const gapEnd = speech[i + 1][0];
    const hadFiller = words.some((w) => w[0] >= gapStart - 0.01 && w[1] <= gapEnd + 0.01 && FILLERS.has(bare(w[2])));
    if (gapEnd - gapStart > PAUSE_SECONDS || hadFiller) {
      const pad = hadFiller && gapEnd - gapStart <= PAUSE_SECONDS ? 0.03 : PAD_SECONDS;
      ranges.push([rangeStart, gapStart + pad]);
      rangeStart = gapEnd - pad;
    }
  }
  ranges.push([rangeStart, Math.min(end, speech[speech.length - 1][1] + PAD_SECONDS + 0.15)]);
  return ranges.filter(([a, b]) => b - a > 0.2);
}

export const rangesDuration = (ranges: [number, number][]) => ranges.reduce((sum, [a, b]) => sum + (b - a), 0);

export interface FrameInput {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  settings: ClipEditSettings;
  captions: CaptionData;
  /** Seconds on the source timeline. */
  time: number;
  /** Seconds since the clip started, on the output timeline. */
  clipTime: number;
  /** AI-reframe center for Fill (0-1), or null to use settings.focusX. */
  center: number | null;
  /** The AI layout for this frame; without one, Fill (or Fit if that's all that's allowed). */
  scene?: SceneFrame | null;
  /** The bottom-video split's lower half. */
  background?: { image: CanvasImageSource; width: number; height: number } | null;
  /** The editor is placing captions: show the nearest one when none is due, so there's something to move. */
  placingCaption?: boolean;
  /** The editor is placing the hook: show it even past its time. */
  placingHook?: boolean;
}

/** A drawn caption block, in canvas pixels. */
export interface CaptionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a frame put its captions and hook, for the editor's drag handles. */
export interface FramePlacement {
  caption: Placed;
  /** Null without a hook. */
  hook: Placed | null;
}

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function wrapWords(ctx: Canvas2D, words: string[], maxWidth: number): string[][] {
  const lines: string[][] = [];
  let line: string[] = [];
  for (const word of words) {
    const candidate = [...line, word].join(" ");
    if (line.length && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = [word];
    } else {
      line.push(word);
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Source rect for a crop of `aspect` (w/h), centered on `center` or placed at `focusX`. */
function cropRect(srcW: number, srcH: number, aspect: number, center: number | null, focusX: number) {
  if (srcW / srcH > aspect) {
    const sw = srcH * aspect;
    const sx =
      center === null
        ? (srcW - sw) * Math.min(1, Math.max(0, focusX))
        : Math.min(srcW - sw, Math.max(0, center * srcW - sw / 2));
    return { sx, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / aspect;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

function popScale(since: number): number {
  const pop = Math.min(1, Math.max(0, since / POP_SECONDS));
  return 0.86 + 0.14 * (1 - (1 - pop) ** 3);
}

/** A damped spring from 0.4 to 1 that overshoots to ~1.14, settling in ~0.3s. */
function springScale(since: number): number {
  const t = Math.max(0, since);
  const zeta = 0.42;
  const omega = 24;
  const root = Math.sqrt(1 - zeta * zeta);
  const s = 1 - Math.exp(-zeta * omega * t) * (Math.cos(omega * root * t) + (zeta / root) * Math.sin(omega * root * t));
  return 0.4 + 0.6 * s;
}

function bounceOut(p: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
}

const easeOutCubic = (p: number) => 1 - (1 - Math.min(1, Math.max(0, p))) ** 3;

/** Light enough that white text on it would be hard to read. */
export function isLight(color: string): boolean {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

const DARK_INK = "#0B0D12";

/** `value` held between `min` and `max`; their midpoint when they cross. */
function clampInside(value: number, min: number, max: number): number {
  return min > max ? (min + max) / 2 : Math.min(max, Math.max(min, value));
}

/** Draws one caption centered on the anchor (pushed back inside the frame if it would spill), and returns its box. */
function drawCaption(
  ctx: Canvas2D,
  width: number,
  height: number,
  anchorX: number,
  anchorY: number,
  chunk: CaptionChunk,
  settings: ClipEditSettings,
  captions: CaptionData,
  time: number,
  u: number
): CaptionBox {
  const template = settings.captions as Exclude<CaptionTemplate, "off">;
  const style = withAccent(CAPTION_TEMPLATES[template], settings.captionColor);
  const fontId = settings.captionFont === "auto" ? style.font : settings.captionFont;
  const px = style.size * u * settings.captionSize * CAPTION_FONTS[fontId].scale;
  const motion = style.motion ?? "group";
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.font = fontSpec(fontId, style.weight, px);

  const texts = chunk.words.map((w) => (style.upper ? w[2].toUpperCase() : w[2]));
  // Arabic reads right to left: the first word sits at the right end of its line.
  const rtl = isRtlText(texts.join(" "));
  const dir = rtl ? -1 : 1;
  ctx.direction = rtl ? "rtl" : "ltr";
  // Arabic letters reach further above and below the line than Latin capitals.
  const tall = rtl ? 1.25 : 1;
  // Every word's slot leaves room for the spoken word's scale-up, so the
  // line doesn't shift (or overlap) as the highlight moves along it.
  const grow = style.active?.scale ?? 1;
  // The line length grows with the size (up to the frame), so resizing scales the block instead of reflowing it.
  const room = width - 2 * (40 * u + (style.pill ? 28 * u : 0));
  const lines = wrapWords(ctx, texts, Math.min(width * (style.pill ? 0.8 : 0.86) * settings.captionSize, room) / grow);
  const lineHeight = px * (style.pill ? 1.2 : 1.1) * tall;
  const blockHeight = lineHeight * lines.length;
  const padX = 28 * u;
  const padY = 16 * u;
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line.join(" ")).width));
  const boxWidth = textWidth + padX * 2;

  // The block's reach (strokes and highlight boxes included, and the emoji
  // that pops above it), so a caption dragged to an edge stays whole.
  const emojiSize = 120 * u;
  const halfW = (style.pill ? boxWidth : textWidth * grow) / 2 + 16 * u;
  const halfH = blockHeight / 2 + (style.pill ? padY : px * 0.2);
  const above = settings.emojis && captions.emojis.size ? blockHeight / 2 + emojiSize * 1.25 : halfH;
  const edge = 24 * u;
  const centerX = clampInside(anchorX, halfW + edge, width - halfW - edge);
  const centerY = clampInside(anchorY, above + edge, height - halfH - edge);
  ctx.translate(centerX, centerY);
  if (motion === "group") {
    const scale = popScale(time - chunk.start);
    ctx.scale(scale, scale);
  }

  if (style.pill) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.beginPath();
    ctx.roundRect(-boxWidth / 2, -blockHeight / 2 - padY, boxWidth, blockHeight + padY * 2, 22 * u);
    ctx.fill();
  }

  // Lay out every word first: the gliding box and the gradients need the whole picture.
  const space = ctx.measureText(" ").width;
  const placed: {
    text: string;
    word: TranscriptWord;
    x: number;
    y: number;
    width: number;
    left: number;
    right: number;
  }[] = [];
  lines.forEach((line, row) => {
    const y = (row - (lines.length - 1) / 2) * lineHeight;
    const widths = line.map((word) => ctx.measureText(word).width);
    const slots = widths.map((w) => w * grow);
    const total = slots.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    let x = -total / 2;
    line.forEach((text, i) => {
      placed.push({
        text,
        word: chunk.words[placed.length],
        x: dir * (x + slots[i] / 2),
        y,
        width: widths[i],
        left: -total / 2,
        right: total / 2,
      });
      x += slots[i] + space;
    });
  });

  // The gliding highlight: rests on the last word said, sliding over from the one before.
  let boxed = -1;
  if (style.slide) {
    for (let i = 0; i < placed.length; i++) if (time >= placed[i].word[0]) boxed = i;
    if (boxed >= 0) {
      const to = placed[boxed];
      const from = boxed > 0 && placed[boxed - 1].y === to.y ? placed[boxed - 1] : null;
      const p = from ? easeOutCubic((time - to.word[0]) / 0.14) : 1;
      const cx = from ? from.x + (to.x - from.x) * p : to.x;
      const w = (from ? from.width + (to.width - from.width) * p : to.width) + 30 * u;
      const h = px * 1.22 * tall;
      const s = from ? 1 : popScale(time - to.word[0]);
      ctx.save();
      ctx.translate(cx, to.y);
      ctx.scale(s, s);
      ctx.fillStyle = style.slide;
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 18 * u;
      ctx.shadowOffsetY = 6 * u;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 18 * u);
      ctx.fill();
      ctx.restore();
    }
  }

  let keywordIndex = 0;
  placed.forEach((item, i) => {
    const [wStart, wEnd, raw] = item.word;
    const since = time - wStart;
    const said = since >= 0;
    const spoken = said && time < Math.max(wEnd, wStart + 0.08);
    // Word-by-word motions keep a word off screen until it's said.
    if (!said && motion !== "group") return;

    let alpha = 1;
    let dy = 0;
    let scale = spoken && style.active?.scale ? style.active.scale : 1;
    if (motion === "spring") {
      scale *= springScale(since);
      alpha = Math.min(1, since / 0.05);
    } else if (motion === "drop") {
      dy = -px * 0.9 * (1 - bounceOut(Math.min(1, since / 0.42)));
      alpha = Math.min(1, since / 0.08);
    } else if (motion === "rise") {
      dy = px * 0.34 * (1 - easeOutCubic(since / 0.26));
      alpha = easeOutCubic(since / 0.2);
    }
    if (style.dimUnspoken && !said) alpha *= 0.45;

    const isKeyword = captions.keywords.has(bare(raw));
    let fill: string | CanvasGradient = style.fill;
    if (style.gradient) {
      // Along the reading direction.
      const [from, to] = rtl ? [item.right, item.left] : [item.left, item.right];
      const gradient = ctx.createLinearGradient(from - item.x, 0, to - item.x, 0);
      style.gradient.forEach((color, k) => gradient.addColorStop(k / (style.gradient!.length - 1), color));
      fill = gradient;
    }
    if (isKeyword && style.keyword) fill = style.keyword[keywordIndex++ % style.keyword.length];
    if (spoken && style.active?.fill) fill = style.active.fill;
    const onBox = (spoken && style.active?.box) || (i === boxed && style.slide);
    if (onBox && isLight(style.active?.box ?? style.slide ?? "")) fill = DARK_INK;

    ctx.save();
    ctx.translate(item.x, item.y + dy);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    if (spoken && style.active?.box) {
      const padX = 14 * u;
      ctx.fillStyle = style.active.box;
      ctx.beginPath();
      ctx.roundRect(-item.width / 2 - padX, -px * 0.58 * tall, item.width + padX * 2, px * 1.16 * tall, 16 * u);
      ctx.fill();
    }
    if (style.depth) {
      const step = 1.5 * u;
      ctx.fillStyle = style.depth.color;
      for (let d = style.depth.layers; d >= 1; d--) ctx.fillText(item.text, d * step, d * step);
    }
    if (style.shadow) {
      ctx.shadowColor = style.shadow.color;
      ctx.shadowBlur = style.shadow.blur * u;
      ctx.shadowOffsetY = style.shadow.dy * u;
    }
    if (style.stroke) {
      ctx.lineWidth = style.stroke.width * u * settings.captionSize;
      ctx.strokeStyle = style.stroke.color;
      ctx.strokeText(item.text, 0, 0);
      ctx.shadowColor = "transparent";
    }
    if (style.glow) {
      ctx.shadowColor = spoken && style.active?.fill ? (style.gradient ? style.glow : style.active.fill) : style.glow;
      ctx.shadowBlur = (spoken ? 36 : 26) * u;
      ctx.shadowOffsetY = 0;
    }
    ctx.fillStyle = fill;
    ctx.fillText(item.text, 0, 0);
    if (style.glow) ctx.fillText(item.text, 0, 0);
    ctx.restore();
  });

  if (settings.emojis && captions.emojis.size) {
    const hit = chunk.words.find((w) => time >= w[0] && captions.emojis.has(bare(w[2])));
    if (hit) {
      const s = popScale(time - hit[0]) ** 2;
      ctx.save();
      ctx.translate(0, -blockHeight / 2 - emojiSize * 0.7);
      ctx.scale(s, s);
      ctx.font = `${emojiSize}px ${EMOJI_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(captions.emojis.get(bare(hit[2]))!, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
  return { x: centerX - halfW, y: centerY - halfH, width: halfW * 2, height: halfH * 2 };
}

const HOOK_LOOKS: Record<HookStyle, { box: string | null; ink: string; base: string | null; accent: string }> = {
  card: { box: "#FFFFFF", ink: DARK_INK, base: "#FFFFFF", accent: "#335CFF" },
  dark: { box: "rgba(11, 13, 18, 0.9)", ink: "#FFFFFF", base: "#0B0D12", accent: "#FFE14D" },
  brand: { box: "#335CFF", ink: "#FFFFFF", base: "#335CFF", accent: "#FFE14D" },
  outline: { box: null, ink: "#FFFFFF", base: null, accent: "#FFE14D" },
};

/** WCAG contrast ratio between two #rrggbb colors (1 = the same, 21 = black on white). */
function contrast(a: string, b: string): number {
  const luminance = (color: string) => {
    const hex = color.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * How the hook's highlighted words are drawn on a look: in the color, or,
 * where the color wouldn't read on the box (yellow on the white card), as
 * ink on a marker of it. A color the box already is falls back to the look's own.
 */
export function hookHighlight(style: HookStyle, color: string): { color: string; marker: boolean } {
  const look = HOOK_LOOKS[style];
  let accent = color === "auto" ? look.accent : color;
  if (look.base && contrast(accent, look.base) < 1.25) accent = look.accent;
  return { color: accent, marker: Boolean(look.base) && contrast(accent, look.base!) < 2.5 };
}

/** Where a frame put the captions or the hook. */
export interface Placed {
  /** The center, as fractions of the frame: the preset's spot for this layout, or the custom one. */
  anchor: { x: number; y: number };
  /** On screen, kept inside the frame, in canvas pixels; null when not on screen. */
  box: CaptionBox | null;
  /** The point of the box that stays put as it grows, as fractions of it (the editor resizes about it). */
  pivot: { x: number; y: number };
}

const CENTER = { x: 0.5, y: 0.5 };

/** The hook's words as drawn (in capitals if asked), with whether each is highlighted. */
function hookWords(text: string, settings: ClipEditSettings): { text: string; hot: boolean }[] {
  const emphasis = new Set(settings.hookEmphasis);
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ text: settings.hookUpper ? word.toUpperCase() : word, hot: emphasis.has(bare(word)) }));
}

/** One hook word at the origin: the outline look's stroke, then the fill (on a marker, its ink). */
function drawHookWord(
  ctx: Canvas2D,
  word: { text: string; hot: boolean },
  px: number,
  u: number,
  ink: string,
  highlight: { color: string; marker: boolean },
  outlined: boolean
) {
  let fill = ink;
  if (word.hot) fill = highlight.marker ? (isLight(highlight.color) ? DARK_INK : "#FFFFFF") : highlight.color;
  if (outlined) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowOffsetY = 6 * u;
    ctx.lineWidth = px * 0.16;
    ctx.strokeStyle = "#000000";
    ctx.strokeText(word.text, 0, 0);
    ctx.shadowColor = "transparent";
  }
  ctx.fillStyle = fill;
  ctx.fillText(word.text, 0, 0);
}

/**
 * The hook headline, laid out around (x, y) -- its top edge when `fromTop`,
 * else its center -- and kept inside the frame. Drawn while it's on screen,
 * with its entrance and (unless it stays for the whole clip) a fade out; a
 * `ghost` (the editor placing it) is drawn at rest regardless, faded when
 * it's past its time. Returns where it sits either way.
 */
function drawHook(
  ctx: Canvas2D,
  width: number,
  height: number,
  x: number,
  y: number,
  fromTop: boolean,
  text: string,
  clipTime: number,
  u: number,
  settings: ClipEditSettings,
  ghost: boolean
): Placed {
  const seconds = settings.hookSeconds;
  const look = HOOK_LOOKS[settings.hookStyle];
  const highlight = hookHighlight(settings.hookStyle, settings.hookColor);
  const px = 54 * u * settings.hookSize * CAPTION_FONTS[settings.hookFont].scale;
  const rtl = isRtlText(text);
  ctx.save();
  ctx.font = fontSpec(settings.hookFont, 800, px);
  ctx.direction = rtl ? "rtl" : "ltr";
  const words = hookWords(text, settings);
  const padX = 34 * u * settings.hookSize;
  const padY = 24 * u * settings.hookSize;
  const edge = 24 * u;
  // The line length grows with the size (up to the frame), so resizing scales the hook instead of reflowing it.
  const rows = wrapWords(
    ctx,
    words.map((w) => w.text),
    Math.min(width * (look.box ? 0.74 : 0.84) * settings.hookSize, width - 2 * (edge + padX))
  );
  const lineHeight = px * (rtl ? 1.45 : 1.2);
  const space = ctx.measureText(" ").width;
  const rowWidths = rows.map((row) => ctx.measureText(row.join(" ")).width);
  const boxWidth = Math.max(...rowWidths) + padX * 2;
  const boxHeight = lineHeight * rows.length + padY * 2;
  const cx = clampInside(x, boxWidth / 2 + edge, width - boxWidth / 2 - edge);
  const cy = clampInside(fromTop ? y + boxHeight / 2 : y, boxHeight / 2 + edge, height - boxHeight / 2 - edge);
  const anchor = { x: cx / width, y: cy / height };
  const pivot = fromTop ? { x: 0.5, y: 0 } : CENTER;
  const live = seconds === 0 || clipTime < seconds;
  if (!live && !ghost) {
    ctx.restore();
    return { anchor, box: null, pivot };
  }

  // The entrance (a ghost is at rest), then the fade out.
  const t = ghost ? 10 : clipTime;
  const motion = settings.hookMotion;
  let scale = 1;
  let dy = 0;
  let alpha = 1;
  if (motion === "pop" || motion === "words") {
    scale = popScale(t) ** 1.5;
  } else if (motion === "drop") {
    dy = -boxHeight * 0.55 * (1 - bounceOut(Math.min(1, t / 0.55)));
    alpha = Math.min(1, t / 0.12);
  } else if (motion === "fade") {
    const p = easeOutCubic(t / 0.45);
    alpha = p;
    scale = 0.94 + 0.06 * p;
  }
  if (!ghost && seconds > 0) alpha *= Math.min(1, (seconds - clipTime) / 0.35);
  if (ghost && !live) alpha *= 0.55;

  ctx.translate(cx, cy + dy);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  if (look.box) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 30 * u;
    ctx.shadowOffsetY = 8 * u;
    ctx.fillStyle = look.box;
    ctx.beginPath();
    ctx.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 26 * u * settings.hookSize);
    ctx.fill();
    ctx.shadowColor = "transparent";
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  let index = 0;
  rows.forEach((row, r) => {
    const rowY = (r - (rows.length - 1) / 2) * lineHeight;
    let left = -rowWidths[r] / 2;
    const placed = row.map((text) => {
      const w = ctx.measureText(text).width;
      // Word by word: each rises in after the one before.
      const p = motion === "words" ? easeOutCubic((t - 0.08 - index * 0.09) / 0.2) : 1;
      // `left` is the word's left edge on screen: from the right end of the row in Arabic.
      const item = { word: words[index++], left: rtl ? -(left + w) : left, w, p };
      left += w + space;
      return item;
    });
    // Markers first, one per run of highlighted words, so neighbours share one.
    if (highlight.marker) {
      for (let i = 0; i < placed.length; i++) {
        if (!placed[i].word.hot) continue;
        let j = i;
        while (j + 1 < placed.length && placed[j + 1].word.hot) j++;
        const first = placed[i];
        const last = placed[j];
        const x0 = Math.min(first.left, last.left);
        const x1 = Math.max(first.left + first.w, last.left + last.w);
        const markerH = px * (rtl ? 1.36 : 1.12);
        ctx.save();
        ctx.globalAlpha = alpha * first.p;
        ctx.fillStyle = highlight.color;
        ctx.beginPath();
        ctx.roundRect(x0 - 10 * u, rowY + (1 - first.p) * px * 0.3 - markerH / 2, x1 - x0 + 20 * u, markerH, 12 * u);
        ctx.fill();
        ctx.restore();
        i = j;
      }
    }
    for (const { word, left: x, w, p } of placed) {
      ctx.save();
      ctx.globalAlpha = alpha * p;
      ctx.translate(x + w / 2, rowY + (1 - p) * px * 0.3);
      drawHookWord(ctx, word, px, u, look.ink, highlight, !look.box);
      ctx.restore();
    }
  });
  ctx.restore();
  return { anchor, box: { x: cx - boxWidth / 2, y: cy - boxHeight / 2, width: boxWidth, height: boxHeight }, pivot };
}

/** The headline above the video in "fit": plain white type over the blurred backdrop. */
function drawHeadline(
  ctx: Canvas2D,
  width: number,
  height: number,
  bottomY: number,
  text: string,
  u: number,
  settings: ClipEditSettings
): Placed {
  const px = 60 * u * settings.hookSize * CAPTION_FONTS[settings.hookFont].scale;
  const highlight = hookHighlight("outline", settings.hookColor);
  const rtl = isRtlText(text);
  ctx.save();
  ctx.font = fontSpec(settings.hookFont, 800, px);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 18 * u;
  const words = hookWords(text, settings);
  const rows = wrapWords(
    ctx,
    words.map((w) => w.text),
    Math.min(width * 0.84 * settings.hookSize, width * 0.92)
  );
  const lineHeight = px * (rtl ? 1.4 : 1.18);
  const space = ctx.measureText(" ").width;
  let index = 0;
  let widest = 0;
  rows.forEach((row, r) => {
    const rowWidth = ctx.measureText(row.join(" ")).width;
    widest = Math.max(widest, rowWidth);
    let left = (width - rowWidth) / 2;
    for (const text of row) {
      const w = ctx.measureText(text).width;
      ctx.fillStyle = words[index++].hot ? highlight.color : "#FFFFFF";
      const x = left + w / 2;
      ctx.fillText(text, rtl ? width - x : x, bottomY - (rows.length - 1 - r) * lineHeight);
      left += w + space;
    }
  });
  ctx.restore();
  const top = bottomY - (rows.length - 1) * lineHeight - px * 0.85;
  const box = { x: (width - widest) / 2 - 12 * u, y: top, width: widest + 24 * u, height: bottomY + px * 0.25 - top };
  return { anchor: { x: 0.5, y: (box.y + box.height / 2) / height }, box, pivot: { x: 0.5, y: 1 } };
}

/**
 * Returns a function that paints one output frame onto `canvas`. Sizes scale
 * with the canvas's short side, so the half-size preview and the full-size
 * export (in any aspect) draw the same picture.
 */
export function createFramePainter(canvas: HTMLCanvasElement | OffscreenCanvas) {
  const ctx = canvas.getContext("2d") as Canvas2D | null;
  if (!ctx) throw new ClipRenderError("Your browser can't draw video frames.");
  // Blurred backdrops: the frame shrunk to a few dozen pixels, then
  // stretched back up, is already soft; ctx.filter adds more where supported.
  const backdrop = makeCanvas(54, 96);
  const backdropCtx = backdrop.getContext("2d") as Canvas2D;

  const blurredFill = (
    source: CanvasImageSource,
    srcW: number,
    srcH: number,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    backdrop.width = Math.max(8, Math.round((54 * w) / Math.max(w, h)));
    backdrop.height = Math.max(8, Math.round((54 * h) / Math.max(w, h)));
    const bw = backdrop.width;
    const bh = backdrop.height;
    const cover = Math.max(bw / srcW, bh / srcH);
    if ("filter" in backdropCtx) backdropCtx.filter = "blur(2px)";
    backdropCtx.fillStyle = "#000";
    backdropCtx.fillRect(0, 0, bw, bh);
    backdropCtx.drawImage(source, (bw - srcW * cover) / 2, (bh - srcH * cover) / 2, srcW * cover, srcH * cover);
    ctx.drawImage(backdrop, x, y, w, h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(x, y, w, h);
  };

  /**
   * One panel: the crop around `crop` (a person, or the frame), scaled into
   * the rect. A crop with a width is a region (a cam box, the game) the panel
   * fills, trimmed to the panel's shape.
   */
  const drawPanel = (
    source: CanvasImageSource,
    srcW: number,
    srcH: number,
    crop: PanelCrop,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    const aspect = w / h;
    let sh = crop.h * srcH;
    let sw = sh * aspect;
    if (crop.w !== undefined) {
      const rw = crop.w * srcW;
      if (sw > rw) {
        sw = rw;
        sh = sw / aspect;
      }
    }
    if (sw > srcW) {
      sw = srcW;
      sh = sw / aspect;
    }
    if (sh > srcH) {
      sh = srcH;
      sw = sh * aspect;
    }
    const sx = Math.min(srcW - sw, Math.max(0, crop.cx * srcW - sw / 2));
    const sy = Math.min(srcH - sh, Math.max(0, crop.cy * srcH - sh / 2));
    ctx.drawImage(source, sx, sy, sw, sh, x, y, w, h);
  };

  return ({
    source,
    sourceWidth,
    sourceHeight,
    settings,
    captions,
    time,
    clipTime,
    center,
    scene,
    background,
    placingCaption,
    placingHook,
  }: FrameInput): FramePlacement => {
    const { width, height } = canvas;
    const u = Math.min(width, height) / 1080;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // What this frame shows: the bottom-video split, a manual Fill crop, or the AI's layout.
    const fallback: LayoutId = settings.layouts.includes("fill") || !settings.layouts.includes("fit") ? "fill" : "fit";
    let layout: LayoutId | "bottom" = usesBottomVideo(settings)
      ? "bottom"
      : settings.reframe === "manual"
        ? "fill"
        : (scene?.layout ?? fallback);
    // Landscape output keeps the whole frame.
    if (settings.aspect === "16:9" && layout !== "fit") layout = "fill";
    const followed = settings.reframe === "auto" ? center : null;
    const hook = settings.hookTitle && settings.hookText.trim() ? settings.hookText.trim() : "";
    // The presets' spots move with the layout; a custom spot is fixed (applied below).
    const preset = settings.captionPosition === "custom" ? "bottom" : settings.captionPosition;
    let captionY = height * CAPTION_PRESET_Y[preset];
    let hookY = height * 0.13;
    // In Fit, room above the video for the hook as a plain headline.
    let headlineY: number | null = null;

    if (layout === "fill") {
      const r = cropRect(sourceWidth, sourceHeight, width / height, followed, settings.focusX);
      ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, 0, 0, width, height);
    } else if (layout === "bottom") {
      const half = height / 2;
      const r = cropRect(sourceWidth, sourceHeight, width / half, followed, settings.focusX);
      ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, 0, 0, width, half);
      if (background) {
        const b = cropRect(background.width, background.height, width / half, null, 0.5);
        ctx.drawImage(background.image, b.sx, b.sy, b.sw, b.sh, 0, half, width, half);
      } else {
        blurredFill(source, sourceWidth, sourceHeight, 0, half, width, half);
      }
      captionY = height * { top: 0.2, middle: 0.5, bottom: 0.8 }[preset];
      hookY = height * 0.09;
    } else if (layout === "fit") {
      blurredFill(source, sourceWidth, sourceHeight, 0, 0, width, height);
      const scale = Math.min(width / sourceWidth, (height * (width > height ? 1 : 0.62)) / sourceHeight);
      const fw = sourceWidth * scale;
      const fh = sourceHeight * scale;
      const fx = (width - fw) / 2;
      const fy = (height - fh) / 2;
      ctx.drawImage(source, fx, fy, fw, fh);
      if (fy > 120 * u) headlineY = fy - 56 * u;
      if (fh < height * 0.9) {
        captionY =
          preset === "middle"
            ? height / 2
            : preset === "top"
              ? Math.max(fy + 90 * u, height * 0.2)
              : Math.min(fy + fh + 150 * u, height * 0.86);
      } else {
        captionY = height * { top: 0.18, middle: 0.5, bottom: 0.84 }[preset];
      }
    } else {
      // Panels, each with its own crop, split by a hairline of black.
      // Cam layouts split where the plan says, so the whole cam shows.
      const d = scene?.divide;
      const rects =
        d && (layout === "gameplay" || layout === "screen")
          ? [
              { x: 0, y: 0, w: 1, h: d },
              { x: 0, y: d, w: 1, h: 1 - d },
            ]
          : LAYOUT_PANELS[layout];
      const gap = Math.max(2, Math.round(4 * u));
      rects.forEach((rect, i) => {
        const x = Math.round(rect.x * width) + (rect.x > 0 ? gap / 2 : 0);
        const y = Math.round(rect.y * height) + (rect.y > 0 ? gap / 2 : 0);
        const w = Math.round(rect.w * width) - (rect.x > 0 ? gap / 2 : 0) - (rect.x + rect.w < 1 ? gap / 2 : 0);
        const h = Math.round(rect.h * height) - (rect.y > 0 ? gap / 2 : 0) - (rect.y + rect.h < 1 ? gap / 2 : 0);
        if (layout === "screen" && i === 1) {
          // The screen (without the cam, when the plan cut it out), fitted to the panel over a blur of itself.
          const region = scene?.crops[1];
          const rw = (region?.w ?? 1) * sourceWidth;
          const rh = (region?.h ?? 1) * sourceHeight;
          const rx = Math.max(0, ((region?.cx ?? 0.5) - (region?.w ?? 1) / 2) * sourceWidth);
          const ry = Math.max(0, ((region?.cy ?? 0.5) - (region?.h ?? 1) / 2) * sourceHeight);
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          blurredFill(source, sourceWidth, sourceHeight, x, y, w, h);
          const scale = Math.min(w / rw, h / rh);
          const fw = rw * scale;
          const fh = rh * scale;
          ctx.drawImage(source, rx, ry, rw, rh, x + (w - fw) / 2, y + (h - fh) / 2, fw, fh);
          ctx.restore();
        } else {
          drawPanel(source, sourceWidth, sourceHeight, scene?.crops[i] ?? { cx: 0.5, cy: 0.5, h: 1 }, x, y, w, h);
        }
      });
      const seam = layout === "three" || layout === "four" ? 0.5 : rects[1].y;
      captionY = height * { top: 0.2, middle: seam, bottom: 0.82 }[preset];
      hookY = height * 0.09;
    }

    let captionX = width / 2;
    if (settings.captionPosition === "custom") {
      captionX = width * settings.captionX;
      captionY = height * settings.captionY;
    }
    let caption: CaptionBox | null = null;
    if (settings.captions !== "off") {
      let chunk = captions.chunks.find((c) => time >= c.start && time < c.end);
      let at = time;
      if (!chunk && placingCaption && captions.chunks.length) {
        // Between lines: the closest one, fully said.
        const gap = (c: CaptionChunk) => (time < c.start ? c.start - time : time - c.end);
        chunk = captions.chunks.reduce((a, b) => (gap(b) < gap(a) ? b : a));
        at = (chunk.words.at(-1)?.[0] ?? chunk.start) + 0.5;
      }
      if (chunk?.words.length)
        caption = drawCaption(ctx, width, height, captionX, captionY, chunk, settings, captions, at, u);
    }
    let hookPlaced: Placed | null = null;
    if (hook) {
      const position = settings.hookPosition;
      if (position === "top" && headlineY !== null) {
        hookPlaced = drawHeadline(ctx, width, height, headlineY, hook, u, settings);
      } else {
        const x = position === "custom" ? width * settings.hookX : width / 2;
        const y =
          position === "custom"
            ? height * settings.hookY
            : position === "top"
              ? hookY - 60 * u
              : height * HOOK_PRESET_Y[position];
        hookPlaced = drawHook(ctx, width, height, x, y, position === "top", hook, clipTime, u, settings, !!placingHook);
      }
    }
    return {
      caption: { anchor: { x: captionX / width, y: captionY / height }, box: caption, pivot: CENTER },
      hook: hookPlaced,
    };
  };
}

/** Waits for the fonts a clip draws with; canvas text silently falls back otherwise. */
export async function loadCaptionFonts(fonts: CaptionFont[] = ["sauce"]): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    fonts.flatMap((id) =>
      CAPTION_FONTS[id].weights.map((weight) =>
        document.fonts.load(`${weight} 64px ${CAPTION_FONTS[id].family}`).catch(() => [])
      )
    )
  );
}

export interface SegmentHandlers {
  /** One clip's cut arrived in full. */
  onReady: (index: number, source: ClipSource) => void;
  /** How far into the source video the server's read has got (seconds). */
  onProgress: (time: number) => void;
  onError: (index: number, message: string) => void;
}

const GENERIC_SEGMENT_ERROR = "We couldn't load this clip. Try again.";

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (!a.byteLength) return b;
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

/**
 * Asks for several clips' cuts of the source in one request (one read of the
 * video on the server) and hands each over as soon as it's complete. Every
 * range ends in exactly one onReady or onError.
 */
export async function fetchClipSources(
  projectId: string,
  ranges: { start: number; end: number }[],
  handlers: SegmentHandlers,
  signal?: AbortSignal
): Promise<void> {
  const settled = new Set<number>();
  const failRest = (message: string) => {
    ranges.forEach((_, index) => {
      if (settled.has(index)) return;
      settled.add(index);
      handlers.onError(index, message);
    });
  };

  let response: Response;
  try {
    response = await fetch(`/api/clips/${projectId}/segments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ranges: ranges.map((range) => ({ start: Number(range.start.toFixed(2)), end: Number(range.end.toFixed(2)) })),
      }),
      signal,
    });
  } catch {
    if (!signal?.aborted) failRest(GENERIC_SEGMENT_ERROR);
    return;
  }
  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    failRest(data?.error ?? GENERIC_SEGMENT_ERROR);
    return;
  }

  const parts: Uint8Array[][] = ranges.map(() => []);
  const offsets: number[] = ranges.map(() => 0);
  const reader = response.body.getReader();
  let buffer: Uint8Array = new Uint8Array(0);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer = concat(buffer, value);
      let position = 0;
      while (buffer.byteLength - position >= SEGMENT_HEADER_BYTES) {
        const view = new DataView(buffer.buffer, buffer.byteOffset + position);
        const type = view.getUint8(0);
        const index = view.getUint8(1);
        const length = view.getUint32(2);
        if (buffer.byteLength - position < SEGMENT_HEADER_BYTES + length) break;
        const payload = buffer.slice(position + SEGMENT_HEADER_BYTES, position + SEGMENT_HEADER_BYTES + length);
        position += SEGMENT_HEADER_BYTES + length;
        const number = () => new DataView(payload.buffer).getFloat64(0);

        if (type === SEGMENT_FRAME.progress) {
          handlers.onProgress(number());
        } else if (type === SEGMENT_FRAME.error) {
          const message = new TextDecoder().decode(payload) || GENERIC_SEGMENT_ERROR;
          if (index === SEGMENT_ALL) failRest(message);
          else if (!settled.has(index)) {
            settled.add(index);
            handlers.onError(index, message);
          }
        } else if (index < ranges.length && !settled.has(index)) {
          if (type === SEGMENT_FRAME.start) offsets[index] = number();
          else if (type === SEGMENT_FRAME.data) parts[index].push(payload);
          else if (type === SEGMENT_FRAME.end) {
            settled.add(index);
            const blob = new Blob(parts[index] as BlobPart[], { type: "video/mp4" });
            parts[index] = [];
            if (blob.size < 1024) handlers.onError(index, GENERIC_SEGMENT_ERROR);
            else handlers.onReady(index, { blob, offset: offsets[index] });
          }
        }
      }
      buffer = buffer.slice(position);
    }
  } catch {
    if (signal?.aborted) return;
  }
  failRest(GENERIC_SEGMENT_ERROR);
}

/** A background video's frames on a loop, read in order (export only ever moves forward). */
async function openLoopingFrames(blob: Blob) {
  const { ALL_FORMATS, BlobSource, CanvasSink, Input } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) {
    input.dispose();
    throw new ClipRenderError("The background video couldn't be read.");
  }
  const [first, duration] = await Promise.all([track.getFirstTimestamp(), track.computeDuration()]);
  const span = Math.max(0.5, duration - first);
  const sink = new CanvasSink(track, { width: 720, poolSize: 3 });
  let frames = sink.canvases();
  let current = (await frames.next()).value ?? null;
  let next = (await frames.next()).value ?? null;
  let lastTime = 0;

  return {
    async at(outputTime: number) {
      const t = first + (outputTime % span);
      if (t < lastTime) {
        await frames.return(undefined);
        frames = sink.canvases();
        current = (await frames.next()).value ?? null;
        next = (await frames.next()).value ?? null;
      }
      lastTime = t;
      while (next && next.timestamp <= t) {
        current = next;
        next = (await frames.next()).value ?? null;
      }
      return current ? { image: current.canvas, width: current.canvas.width, height: current.canvas.height } : null;
    },
    dispose() {
      void frames.return(undefined);
      input.dispose();
    },
  };
}

export interface ExportOptions {
  source: ClipSource;
  settings: ClipEditSettings;
  words: TranscriptWord[];
  clip: { keywords?: string[]; emojis?: ClipEmoji[] };
  track: ReframeTrack | null;
  background: Blob | null;
  /** Receives 0..1. */
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  duration: number;
}

/**
 * Renders the finished MP4 (H.264 + AAC, 30fps) at the chosen aspect. Each
 * kept range is decoded in turn and stitched onto one output timeline, so
 * pause removal is just more than one range. The bitrate is sized to keep
 * the file under the library's upload cap.
 */
export async function exportClip({
  source,
  settings,
  words,
  clip,
  track,
  background,
  onProgress,
  signal,
}: ExportOptions): Promise<ExportResult> {
  const mb = await import("mediabunny");
  if (typeof VideoEncoder === "undefined") {
    throw new ClipRenderError("Your browser can't render video. Use a recent Chrome, Edge or Safari.");
  }

  let { width, height } = OUTPUT_SIZES[settings.aspect];
  if (!(await mb.canEncodeVideo("avc", { width, height }))) {
    width = Math.round((width * 2) / 3 / 2) * 2;
    height = Math.round((height * 2) / 3 / 2) * 2;
    if (!(await mb.canEncodeVideo("avc", { width, height }))) {
      throw new ClipRenderError("Your browser can't encode H.264 video. Use a recent Chrome, Edge or Safari.");
    }
  }

  const ranges = keepRanges(words, settings.start, settings.end, settings.removePauses).map(
    ([a, b]) => [Math.max(0, a - source.offset), b - source.offset] as [number, number]
  );
  const total = rangesDuration(ranges);
  if (!(total > 0.5)) throw new ClipRenderError("This clip is too short to render.");
  const bitrate = Math.round(Math.min(8e6, Math.max(2e6, (CLIP_EXPORT_MAX_BYTES * 0.9 * 8) / total - 192e3)));

  await loadCaptionFonts(fontsFor(settings, words));
  const canvas = makeCanvas(width, height);
  const paint = createFramePainter(canvas);
  const captions = prepareCaptions(words, settings, clip);
  const path = track ? cameraPath(track, cropAspectFor(settings), settings.camera) : null;
  const plan = planFor(track, settings);

  const input = new mb.Input({ source: new mb.BlobSource(source.blob), formats: mb.ALL_FORMATS });
  const loop = background ? await openLoopingFrames(background) : null;
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack || !(await videoTrack.canDecode())) {
      throw new ClipRenderError("This clip can't be decoded in your browser.");
    }
    const audioTrack = await input.getPrimaryAudioTrack().catch(() => null);
    const withAudio = Boolean(audioTrack && (await audioTrack.canDecode()));
    const audioCodec = (await mb.canEncodeAudio("aac")) ? "aac" : "opus";

    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    const videoOut = new mb.VideoSampleSource({ codec: "avc", bitrate, keyFrameInterval: 2 });
    output.addVideoTrack(videoOut, { frameRate: OUTPUT_FPS });
    const audioOut = withAudio ? new mb.AudioSampleSource({ codec: audioCodec, bitrate: 160e3 }) : null;
    if (audioOut) output.addAudioTrack(audioOut);
    await output.start();

    const checkAbort = () => {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    };

    const pumpVideo = async () => {
      const sink = new mb.VideoSampleSink(videoTrack);
      let base = 0;
      let frameIndex = 0;
      for (const [a, b] of ranges) {
        for await (const sample of sink.samples(a, b)) {
          try {
            checkAbort();
            const sampleEnd = sample.timestamp + sample.duration;
            // Every output frame (on the fixed 30fps grid) this sample covers.
            for (;;) {
              const outTime = frameIndex / OUTPUT_FPS;
              const local = a + (outTime - base);
              if (local >= b - 1e-6 || local >= sampleEnd) break;
              const time = local + source.offset;
              paint({
                source: sample.toCanvasImageSource(),
                sourceWidth: sample.displayWidth,
                sourceHeight: sample.displayHeight,
                settings,
                captions,
                time,
                clipTime: outTime,
                center: centerAt(path, time),
                scene: sceneAt(plan, time),
                background: loop ? await loop.at(outTime) : null,
              });
              const frame = new mb.VideoSample(canvas, { timestamp: outTime, duration: 1 / OUTPUT_FPS });
              await videoOut.add(frame);
              frame.close();
              frameIndex++;
              onProgress?.(Math.min(0.99, outTime / total));
            }
          } finally {
            sample.close();
          }
        }
        base += b - a;
      }
      videoOut.close();
      return frameIndex;
    };

    const pumpAudio = async () => {
      if (!audioOut || !audioTrack) return;
      const sink = new mb.AudioSampleSink(audioTrack);
      let base = 0;
      const fade = 0.008;
      for (const [a, b] of ranges) {
        for await (const sample of sink.samples(a, b)) {
          try {
            checkAbort();
            const from = Math.max(a, sample.timestamp);
            const to = Math.min(b, sample.timestamp + sample.duration);
            const rate = sample.sampleRate;
            const channels = sample.numberOfChannels;
            const offsetFrames = Math.max(0, Math.round((from - sample.timestamp) * rate));
            const count = Math.min(sample.numberOfFrames - offsetFrames, Math.round((to - from) * rate));
            if (count <= 0) continue;
            const data = new Float32Array(count * channels);
            for (let c = 0; c < channels; c++) {
              sample.copyTo(data.subarray(c * count, (c + 1) * count), {
                planeIndex: c,
                format: "f32-planar",
                frameOffset: offsetFrames,
                frameCount: count,
              });
            }
            // A few ms of fade at every cut so jump cuts don't click.
            const intoRange = from - a;
            const leftInRange = b - to;
            if (intoRange < fade || leftInRange < fade) {
              for (let i = 0; i < count; i++) {
                const t = i / rate;
                const gain = Math.min(1, (intoRange + t) / fade, (leftInRange + (count - i) / rate) / fade);
                if (gain < 1) for (let c = 0; c < channels; c++) data[c * count + i] *= gain;
              }
            }
            const out = new mb.AudioSample({
              data,
              format: "f32-planar",
              numberOfChannels: channels,
              sampleRate: rate,
              timestamp: base + intoRange,
            });
            await audioOut.add(out);
            out.close();
          } finally {
            sample.close();
          }
        }
        base += b - a;
      }
      audioOut.close();
    };

    let frames = 0;
    await Promise.all([pumpVideo().then((count) => (frames = count)), pumpAudio()]);
    // A cut that doesn't cover the clip "renders" into an empty file; say so instead.
    if (frames < total * OUTPUT_FPS * 0.5) throw new ClipRenderError("This clip came out empty. Try again.");
    await output.finalize();
    onProgress?.(1);

    const buffer = (output.target as InstanceType<typeof mb.BufferTarget>).buffer;
    if (!buffer || buffer.byteLength < 1024) throw new ClipRenderError("Rendering produced no video. Try again.");
    return { blob: new Blob([buffer], { type: "video/mp4" }), duration: total };
  } catch (error) {
    if (error instanceof ClipRenderError || signal?.aborted) throw error;
    console.error("[clip-render]", error);
    throw new ClipRenderError("We couldn't render this clip. Try again.");
  } finally {
    loop?.dispose();
    input.dispose();
  }
}
