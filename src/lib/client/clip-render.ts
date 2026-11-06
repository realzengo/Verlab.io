// Turns a cut of the source video into a finished short, entirely in the
// browser (WebCodecs via Mediabunny; the server has no ffmpeg). One painter
// draws every frame -- the editor's live preview and the export run the same
// code, so what the user sees is what they download.
//
// What a frame can carry: an AI-reframed crop (or fit-with-blur, or a
// split screen over a background video), word-timed captions in one of six
// templates with keyword colors and emojis, and a hook headline. The export
// can also cut out pauses and filler words (jump cuts).

import { centerAt, type ReframeTrack } from "@/lib/client/clip-reframe";
import { CLIP_EXPORT_MAX_BYTES, type ClipAspect, type ClipEmoji, type TranscriptWord } from "@/lib/clips";
import { SEGMENT_ALL, SEGMENT_FRAME, SEGMENT_HEADER_BYTES } from "@/lib/clip-segments";

export type ClipLayout = "fill" | "fit" | "split";
export type CaptionTemplate = "karaoke" | "beast" | "hormozi" | "clean" | "neon" | "minimal" | "off";
export type CaptionPosition = "top" | "middle" | "bottom";

export interface ClipEditSettings {
  /** Seconds on the source timeline. */
  start: number;
  end: number;
  aspect: ClipAspect;
  layout: ClipLayout;
  /** "auto" follows faces (AI reframe); "manual" uses focusX. */
  reframe: "auto" | "manual";
  /** Horizontal position of the crop in manual mode, 0 (left) to 1 (right). */
  focusX: number;
  captions: CaptionTemplate;
  captionPosition: CaptionPosition;
  emojis: boolean;
  /** The hook headline: over the first seconds, or above the video in "fit". */
  hookTitle: boolean;
  hookText: string;
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

const FONT_FAMILY = '"Open Sauce One", system-ui, sans-serif';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const HOOK_SECONDS = 3.5;
const POP_SECONDS = 0.12;
const OUTPUT_FPS = 30;

interface TemplateStyle {
  label: string;
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
}

export const CAPTION_TEMPLATES: Record<Exclude<CaptionTemplate, "off">, TemplateStyle> = {
  karaoke: {
    label: "Karaoke",
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

const bare = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/** Splits the clip's words into the groups shown one at a time. */
export function captionChunks(
  words: TranscriptWord[],
  start: number,
  end: number,
  template: CaptionTemplate = "hormozi"
): CaptionChunk[] {
  const style = CAPTION_TEMPLATES[template === "off" ? "hormozi" : template];
  const inRange = words.filter((w) => w[1] > start && w[0] < end);
  const chunks: CaptionChunk[] = [];
  let current: TranscriptWord[] = [];
  inRange.forEach((word, index) => {
    current.push(word);
    const next = inRange[index + 1];
    const chars = current.reduce((sum, w) => sum + w[2].length + 1, 0);
    if (
      !next ||
      /[.,!?;:…]["')\]]?$/.test(word[2]) ||
      current.length >= style.maxWords ||
      chars >= style.maxChars ||
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
  settings: Pick<ClipEditSettings, "start" | "end" | "captions">,
  clip: { keywords?: string[]; emojis?: ClipEmoji[] }
): CaptionData {
  return {
    chunks: captionChunks(words, settings.start, settings.end, settings.captions),
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
  /** AI-reframe center for this frame (0-1), or null to use settings.focusX. */
  center: number | null;
  /** The split screen's lower half. */
  background?: { image: CanvasImageSource; width: number; height: number } | null;
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

function drawCaption(
  ctx: Canvas2D,
  width: number,
  centerY: number,
  chunk: CaptionChunk,
  template: Exclude<CaptionTemplate, "off">,
  captions: CaptionData,
  time: number,
  emojis: boolean,
  u: number
) {
  const style = CAPTION_TEMPLATES[template];
  const size = style.size * u;
  ctx.save();
  ctx.translate(width / 2, centerY);
  const scale = popScale(time - chunk.start);
  ctx.scale(scale, scale);
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.font = `${style.weight} ${size}px ${FONT_FAMILY}`;

  const texts = chunk.words.map((w) => (style.upper ? w[2].toUpperCase() : w[2]));
  // Every word's slot leaves room for the spoken word's scale-up, so the
  // line doesn't shift (or overlap) as the highlight moves along it.
  const grow = style.active?.scale ?? 1;
  const lines = wrapWords(ctx, texts, (width * (style.pill ? 0.8 : 0.86)) / grow);
  const lineHeight = size * (style.pill ? 1.2 : 1.08);
  const blockHeight = lineHeight * lines.length;

  if (style.pill) {
    const padX = 28 * u;
    const padY = 16 * u;
    const boxWidth = Math.max(...lines.map((line) => ctx.measureText(line.join(" ")).width)) + padX * 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.beginPath();
    ctx.roundRect(-boxWidth / 2, -blockHeight / 2 - padY, boxWidth, blockHeight + padY * 2, 22 * u);
    ctx.fill();
  }

  let index = 0;
  let keywordIndex = 0;
  const space = ctx.measureText(" ").width;
  lines.forEach((line, row) => {
    const y = (row - (lines.length - 1) / 2) * lineHeight;
    const widths = line.map((word) => ctx.measureText(word).width);
    const slots = widths.map((w) => w * grow);
    let x = -(slots.reduce((a, b) => a + b, 0) + space * (line.length - 1)) / 2;
    line.forEach((word, i) => {
      const [wStart, wEnd, raw] = chunk.words[index++];
      const spoken = time >= wStart && time < Math.max(wEnd, wStart + 0.08);
      const said = time >= wStart;
      const isKeyword = captions.keywords.has(bare(raw));
      let fill = style.fill;
      if (isKeyword && style.keyword) fill = style.keyword[keywordIndex++ % style.keyword.length];
      if (spoken && style.active?.fill) fill = style.active.fill;
      const wordScale = spoken && style.active?.scale ? style.active.scale : 1;
      const cx = x + slots[i] / 2;

      ctx.save();
      ctx.translate(cx, y);
      ctx.scale(wordScale, wordScale);
      ctx.textAlign = "center";
      if (spoken && style.active?.box) {
        const padX = 14 * u;
        ctx.fillStyle = style.active.box;
        ctx.beginPath();
        ctx.roundRect(-widths[i] / 2 - padX, -size * 0.58, widths[i] + padX * 2, size * 1.16, 16 * u);
        ctx.fill();
      }
      if (style.dimUnspoken) ctx.globalAlpha = said ? 1 : 0.5;
      if (style.shadow) {
        ctx.shadowColor = style.shadow.color;
        ctx.shadowBlur = style.shadow.blur * u;
        ctx.shadowOffsetY = style.shadow.dy * u;
      }
      if (style.stroke) {
        ctx.lineWidth = style.stroke.width * u;
        ctx.strokeStyle = style.stroke.color;
        ctx.strokeText(word, 0, 0);
        ctx.shadowColor = "transparent";
      }
      if (style.glow) {
        ctx.shadowColor = spoken && style.active?.fill ? style.active.fill : style.glow;
        ctx.shadowBlur = 28 * u;
        ctx.shadowOffsetY = 0;
      }
      ctx.fillStyle = fill;
      ctx.fillText(word, 0, 0);
      if (style.glow) ctx.fillText(word, 0, 0);
      ctx.restore();
      x += slots[i] + space;
    });
  });

  if (emojis && captions.emojis.size) {
    const hit = chunk.words.find((w) => time >= w[0] && captions.emojis.has(bare(w[2])));
    if (hit) {
      const emojiSize = 120 * u;
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
}

/** The hook headline in a white card, popping in and fading out over the first seconds. */
function drawHook(ctx: Canvas2D, width: number, centerY: number, text: string, clipTime: number, u: number) {
  if (clipTime >= HOOK_SECONDS) return;
  const size = 54 * u;
  ctx.save();
  ctx.font = `800 ${size}px ${FONT_FAMILY}`;
  const lines = wrapWords(ctx, text.split(/\s+/).filter(Boolean), width * 0.74).slice(0, 3);
  const lineHeight = size * 1.2;
  const padX = 34 * u;
  const padY = 24 * u;
  const boxWidth = Math.max(...lines.map((line) => ctx.measureText(line.join(" ")).width)) + padX * 2;
  const boxHeight = lineHeight * lines.length + padY * 2;
  ctx.translate(width / 2, centerY);
  const scale = popScale(clipTime) ** 1.5;
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.min(1, (HOOK_SECONDS - clipTime) / 0.35);
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 30 * u;
  ctx.shadowOffsetY = 8 * u;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 26 * u);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#0B0D12";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, row) => {
    ctx.fillText(line.join(" "), 0, (row - (lines.length - 1) / 2) * lineHeight);
  });
  ctx.restore();
}

/** The headline above the video in "fit": plain white type over the blurred backdrop. */
function drawHeadline(ctx: Canvas2D, width: number, bottomY: number, text: string, u: number) {
  const size = 60 * u;
  ctx.save();
  ctx.font = `800 ${size}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 18 * u;
  const lines = wrapWords(ctx, text.split(/\s+/).filter(Boolean), width * 0.84).slice(0, 3);
  const lineHeight = size * 1.18;
  lines.forEach((line, row) => {
    ctx.fillText(line.join(" "), width / 2, bottomY - (lines.length - 1 - row) * lineHeight);
  });
  ctx.restore();
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

  return ({
    source,
    sourceWidth,
    sourceHeight,
    settings,
    captions,
    time,
    clipTime,
    center,
    background,
  }: FrameInput) => {
    const { width, height } = canvas;
    const u = Math.min(width, height) / 1080;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    const layout: ClipLayout = settings.layout === "split" && settings.aspect === "16:9" ? "fit" : settings.layout;
    const followed = settings.reframe === "auto" ? center : null;
    const hook = settings.hookTitle && settings.hookText.trim() ? settings.hookText.trim() : "";
    const positionY = { top: 0.24, middle: 0.5, bottom: 0.72 }[settings.captionPosition];
    let captionY = height * positionY;
    let hookY = height * 0.13;

    if (layout === "fill") {
      const r = cropRect(sourceWidth, sourceHeight, width / height, followed, settings.focusX);
      ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, 0, 0, width, height);
    } else if (layout === "split") {
      const half = height / 2;
      const r = cropRect(sourceWidth, sourceHeight, width / half, followed, settings.focusX);
      ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, 0, 0, width, half);
      if (background) {
        const b = cropRect(background.width, background.height, width / half, null, 0.5);
        ctx.drawImage(background.image, b.sx, b.sy, b.sw, b.sh, 0, half, width, half);
      } else {
        blurredFill(source, sourceWidth, sourceHeight, 0, half, width, half);
      }
      captionY = height * { top: 0.2, middle: 0.5, bottom: 0.8 }[settings.captionPosition];
      hookY = height * 0.09;
    } else {
      blurredFill(source, sourceWidth, sourceHeight, 0, 0, width, height);
      const scale = Math.min(width / sourceWidth, (height * (width > height ? 1 : 0.62)) / sourceHeight);
      const fw = sourceWidth * scale;
      const fh = sourceHeight * scale;
      const fx = (width - fw) / 2;
      const fy = (height - fh) / 2;
      ctx.drawImage(source, fx, fy, fw, fh);
      if (hook && fy > 120 * u) drawHeadline(ctx, width, fy - 56 * u, hook, u);
      if (fh < height * 0.9) {
        captionY =
          settings.captionPosition === "middle"
            ? height / 2
            : settings.captionPosition === "top"
              ? Math.max(fy + 90 * u, height * 0.2)
              : Math.min(fy + fh + 150 * u, height * 0.86);
      } else {
        captionY = height * { top: 0.18, middle: 0.5, bottom: 0.84 }[settings.captionPosition];
      }
    }

    if (settings.captions !== "off") {
      const chunk = captions.chunks.find((c) => time >= c.start && time < c.end);
      if (chunk) drawCaption(ctx, width, captionY, chunk, settings.captions, captions, time, settings.emojis, u);
    }
    if (hook && layout !== "fit") drawHook(ctx, width, hookY, hook, clipTime, u);
  };
}

/** Waits for the caption fonts; canvas text silently falls back otherwise. */
export async function loadCaptionFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    ["900", "800", "700", "600"].map((weight) => document.fonts.load(`${weight} 64px ${FONT_FAMILY}`).catch(() => []))
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

  await loadCaptionFonts();
  const canvas = makeCanvas(width, height);
  const paint = createFramePainter(canvas);
  const captions = prepareCaptions(words, settings, clip);

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
                center: centerAt(track, time),
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
