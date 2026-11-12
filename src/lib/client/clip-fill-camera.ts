// The Fill camera: how a single crop of a 16:9 source frames a vertical (or
// square) clip, shot by shot, the way an editor would cut it by hand.
//
// - Framing: the crop zooms in on a small face (a wide vlog shot) until it
//   fills about a fifth of the frame, as far as the source's resolution
//   allows, and puts the face on the upper third, not dead center.
// - People: when everyone who matters in a shot fits in one crop, it frames
//   them together; otherwise it follows whoever is talking (clip-reframe's
//   speaker track) and cuts to the next speaker on the first word they say.
// - Zooms: punch-ins on new phrases, stronger on the clip's keywords, and
//   one on every jump cut so the jump reads as an edit. "punchy" cuts
//   straight in (MrBeast-style), "subtle" eases in and drifts slowly.
// The crop stays still within a shot unless the person moves ("smooth"), or
// tracks them continuously ("follow").

import { centerAt, fillGaps, gaussian, medianFilter, operate } from "@/lib/client/clip-reframe";
import type { CameraMode, CameraPath, ReframeTrack } from "@/lib/client/clip-reframe";
import type { TranscriptWord } from "@/lib/clips";

export type ZoomStyle = "off" | "subtle" | "punchy";

export interface FillOptions {
  zoom: ZoomStyle;
  /** The project's transcript, source timeline. */
  words: TranscriptWord[];
  /** The clip's keywords, as wordKey()s. */
  keywords: Set<string>;
  /** Source times where a jump cut joins two kept ranges. */
  jumps: number[];
}

/** The crop over time: center, base height, and the punch-in zoom on top of it. */
export interface FillPanel {
  x: CameraPath;
  y: CameraPath;
  heights: CameraPath;
  zoomAt: (time: number) => number;
  /** How far above the crop's center the face sits, as a share of its height: zooms keep the face in place. */
  lift: number;
}

/** A person in a shot, from the layout planner. */
export interface ShotPerson {
  id: number;
  size: number;
}

// The face's center sits this far down the frame (the upper third).
const FACE_LINE = 0.38;
const LIFT = 0.5 - FACE_LINE;
// A followed face fills about this much of the frame's height after zooming.
const FACE_TARGET = 0.19;
// The tightest crop, in source pixels tall, before upscaling turns it soft.
const SHARP_PIXELS = 540;
const MIN_CROP_FLOOR = 0.5;
const MIN_CROP_CEILING = 0.8;
// Room around a group: this many face widths beyond the outer faces.
const GROUP_MARGIN = 0.7;
// A speaker cut moves to the start of a word this close to it.
const SNAP_BEFORE = 0.5;
const SNAP_AFTER = 0.4;
// A phrase starts after a pause this long, or after a sentence ends.
const PHRASE_PAUSE = 0.28;
// No speaker shot shorter than this at either end of a shot.
const MIN_HOLD = 0.5;

const ZOOMS: Record<
  Exclude<ZoomStyle, "off">,
  { level: number; strong: number; every: number; ease: number; drift: number }
> = {
  punchy: { level: 1.18, strong: 1.3, every: 1.8, ease: 0, drift: 0 },
  subtle: { level: 1.08, strong: 1.13, every: 3.5, ease: 0.45, drift: 0.035 },
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const bare = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/** The tightest crop height (share of the source) that stays sharp. */
export function minCropFor(track: ReframeTrack): number {
  return clamp(SHARP_PIXELS / (track.height ?? 1080), MIN_CROP_FLOOR, MIN_CROP_CEILING);
}

/** The face being followed in each sample: the one at the speaker track's position. */
function subjectFaces(track: ReframeTrack, from: number, to: number) {
  return Array.from({ length: to - from }, (_, k) => {
    const i = from + k;
    const x = track.subject[i];
    if (x === null || x === undefined) return null;
    let best: ReframeTrack["frames"][number][number] | null = null;
    for (const face of track.frames[i] ?? []) {
      if (!best || Math.abs(face.x - x) < Math.abs(best.x - x)) best = face;
    }
    return best && Math.abs(best.x - x) < 0.02 ? best : null;
  });
}

/**
 * Moves a speaker cut onto the start of a word: where they start speaking
 * after a breath if there's one close by, else the nearest word.
 */
function snapToSpeech(time: number, words: TranscriptWord[], lo: number, hi: number): number {
  let onset: number | null = null;
  let nearest: number | null = null;
  const closer = (a: number | null, b: number) => (a === null || Math.abs(b - time) < Math.abs(a - time) ? b : a);
  for (let i = 0; i < words.length; i++) {
    const start = words[i][0];
    if (start < time - SNAP_BEFORE || start <= lo + 0.3 || start >= hi - 0.3) continue;
    if (start > time + SNAP_AFTER) break;
    if (i === 0 || start - words[i - 1][1] >= 0.12) onset = closer(onset, start);
    if (Math.abs(start - time) <= 0.25) nearest = closer(nearest, start);
  }
  return onset ?? nearest ?? time;
}

interface Segment {
  start: number;
  end: number;
  x: CameraPath;
  y: CameraPath;
  h: number;
  /** The followed face's median height, or null when no face was seen. */
  face: number | null;
}

/** One stretch of a shot with one framing: who it follows, how tight, where. */
function frameSegment(
  track: ReframeTrack,
  from: number,
  to: number,
  start: number,
  end: number,
  outputAspect: number,
  camera: CameraMode,
  minCrop: number,
  group: number[] | null,
  lastX: number
): Segment {
  const times = track.times.slice(from, to);
  // Per sample: where to center (x, y), and how wide the people to keep are.
  let xs: (number | null)[];
  let ys: (number | null)[];
  let faceHs: number[];
  let extent = 0;
  if (group) {
    const spans: number[] = [];
    xs = [];
    ys = [];
    faceHs = [];
    for (let i = from; i < to; i++) {
      const faces = (track.frames[i] ?? []).filter((f) => group.includes(f.id));
      if (!faces.length) {
        xs.push(null);
        ys.push(null);
        continue;
      }
      const left = Math.min(...faces.map((f) => f.x - f.w * (0.5 + GROUP_MARGIN)));
      const right = Math.max(...faces.map((f) => f.x + f.w * (0.5 + GROUP_MARGIN)));
      xs.push((left + right) / 2);
      ys.push(faces.reduce((sum, f) => sum + f.y, 0) / faces.length);
      faceHs.push(Math.max(...faces.map((f) => f.h)));
      spans.push(right - left);
    }
    extent = median(spans);
  } else {
    const faces = subjectFaces(track, from, to);
    xs = faces.map((f) => f?.x ?? null);
    ys = faces.map((f) => f?.y ?? null);
    faceHs = faces.flatMap((f) => (f ? [f.h] : []));
  }

  if (!faceHs.length) {
    // Nobody to frame: the whole height, held where the camera was.
    return {
      start,
      end,
      x: { times: [start], centers: [lastX] },
      y: { times: [start], centers: [0.5] },
      h: 1,
      face: null,
    };
  }

  const face = median(faceHs);
  // Tight enough for the face to read, loose enough for the group and to stay sharp.
  const fitGroup = (extent * track.aspect) / outputAspect;
  const h = clamp(Math.max(face / FACE_TARGET, fitGroup, minCrop), minCrop, 1);
  const cropW = Math.min(1, (h * outputAspect) / track.aspect);
  const loX = cropW / 2;
  const hiX = 1 - cropW / 2;
  const rawX = fillGaps(xs, lastX).map((v) => clamp(v, loX, hiX));
  const smoothX = gaussian(medianFilter(rawX, 2), camera === "follow" ? 2 : 1.5);
  const x = camera === "follow" ? { times, centers: smoothX } : operate(times, smoothX, cropW, end - 0.002);

  // The face on the upper third; a full-height crop can't move up or down.
  const toCy = (y: number) => clamp(y + LIFT * h, h / 2, 1 - h / 2);
  const rawY = fillGaps(ys, median(ys.filter((v): v is number => v !== null))).map(toCy);
  const y =
    camera === "follow"
      ? { times, centers: gaussian(medianFilter(rawY, 2), 3) }
      : { times: [times[0]], centers: [median(rawY)] };
  return { start, end, x, y, h, face };
}

/** A path's keys within [start, end), with its values at both ends. */
function window(path: CameraPath, start: number, end: number): CameraPath {
  const times = [start];
  const centers = [centerAt(path, start) ?? 0.5];
  path.times.forEach((t, i) => {
    if (t > start && t < end - 0.002) {
      times.push(t);
      centers.push(path.centers[i]);
    }
  });
  times.push(end - 0.001);
  centers.push(centerAt(path, end - 0.001) ?? centers[centers.length - 1]);
  return { times, centers };
}

function join(parts: CameraPath[]): CameraPath {
  return { times: parts.flatMap((p) => p.times), centers: parts.flatMap((p) => p.centers) };
}

/** Where the punch-ins change: new phrases (and every jump cut), with whether the phrase carries a keyword. */
function zoomBeats(options: FillOptions, segment: Segment, every: number): { time: number; strong: boolean }[] {
  const first = options.words.findIndex((w) => w[0] >= segment.start);
  const words = first === -1 ? [] : options.words.slice(first).filter((w) => w[0] < segment.end);
  const beats: { time: number; strong: boolean }[] = [];
  const opensPhrase = (i: number) => {
    const prev = options.words[first + i - 1];
    return !prev || words[i][0] - prev[1] >= PHRASE_PAUSE || /[.!?…]["')\]]?$/.test(prev[2]);
  };
  const jumps = options.jumps.filter((t) => t > segment.start + 0.5 && t < segment.end - 0.5);
  let last = segment.start;
  const candidates = [
    ...words.flatMap((w, i) => (i > 0 && opensPhrase(i) ? [{ time: w[0], jump: false }] : [])),
    ...jumps.map((time) => ({ time, jump: true })),
  ].sort((a, b) => a.time - b.time);
  for (const { time, jump } of candidates) {
    if (time < segment.start + 0.6 || time > segment.end - 0.8) continue;
    // A jump cut always gets one (it hides the jump); a phrase only when the last zoom has had its time.
    if (time - last < (jump ? 0.7 : every)) continue;
    const next = candidates.find((c) => c.time > time + 0.05)?.time ?? segment.end;
    const strong = words.some((w) => w[0] >= time && w[0] < next && options.keywords.has(bare(w[2])));
    beats.push({ time, strong });
    last = time;
  }
  return beats;
}

/** The punch-in zoom over a segment: alternating levels at each beat, eased or cut, with a slow drift. */
function segmentZoom(options: FillOptions, segment: Segment, minCrop: number): (time: number) => number {
  if (options.zoom === "off" || segment.face === null) return () => 1;
  const style = ZOOMS[options.zoom];
  // Never so tight the face crowds the frame or the picture goes soft.
  const most = Math.max(1, Math.min((0.42 * segment.h) / segment.face, segment.h / (minCrop * 0.88)));
  const levels: { time: number; from: number; to: number }[] = [];
  let current = 1;
  for (const beat of zoomBeats(options, segment, style.every)) {
    const next = current > 1 ? 1 : Math.min(most, beat.strong ? style.strong : style.level);
    if (next !== current) levels.push({ time: beat.time, from: current, to: next });
    current = next;
  }
  const length = segment.end - segment.start;
  const drift = length >= 3 ? style.drift : 0;
  return (time) => {
    let level = 1;
    for (const change of levels) {
      if (time < change.time - (style.ease ? 0.05 : 0)) break;
      const p = style.ease ? clamp((time - change.time + 0.05) / style.ease, 0, 1) : 1;
      level = change.from + (change.to - change.from) * ease(p);
    }
    const pushed = 1 + drift * clamp((time - segment.start) / length, 0, 1);
    return Math.min(Math.max(most, 1), level * pushed);
  };
}

/**
 * The Fill camera for one shot (samples from..to, ending at `end`).
 * `people` are the shot's regulars, main first (see layoutPlan).
 */
export function fillPanel(
  track: ReframeTrack,
  from: number,
  to: number,
  end: number,
  people: ShotPerson[],
  outputAspect: number,
  camera: CameraMode,
  options: FillOptions,
  lastX: number
): FillPanel {
  const minCrop = minCropFor(track);
  const start = track.times[from];

  // Everyone fits in the widest crop: frame them together rather than cutting between them.
  let group: number[] | null = null;
  if (people.length >= 2) {
    const ids = people.slice(0, 3).map((p) => p.id);
    const widest = Math.min(1, outputAspect / track.aspect);
    const spans: number[] = [];
    for (let i = from; i < to; i++) {
      const faces = (track.frames[i] ?? []).filter((f) => ids.includes(f.id));
      if (faces.length < 2) continue;
      const left = Math.min(...faces.map((f) => f.x - f.w * (0.5 + GROUP_MARGIN)));
      const right = Math.max(...faces.map((f) => f.x + f.w * (0.5 + GROUP_MARGIN)));
      spans.push(right - left);
    }
    if (spans.length >= (to - from) * 0.4 && median(spans) <= widest * 0.95) group = ids;
  }

  // Otherwise one stretch per speaker, cut on their first word.
  const bounds = [from];
  if (!group) for (let i = from + 1; i < to; i++) if (track.breaks[i] && !track.cuts[i]) bounds.push(i);
  // A switch just after the shot opens would flash the first speaker: the new one takes the whole start.
  if (bounds.length > 1 && track.times[bounds[1]] - start < MIN_HOLD) bounds.shift();
  const starts = bounds.map((i, k) => (k === 0 ? start : snapToSpeech(track.times[i], options.words, start, end)));
  // Two switches close together can't cross once snapped; one squeezed past the shot's end is dropped.
  for (let k = 1; k < starts.length; k++) starts[k] = Math.max(starts[k], starts[k - 1] + 0.3);
  while (starts.length > 1 && starts[starts.length - 1] > end - MIN_HOLD) {
    starts.pop();
    bounds.pop();
  }

  const segments: Segment[] = [];
  let x = lastX;
  bounds.forEach((i, k) => {
    const segmentEnd = starts[k + 1] ?? end;
    const segment = frameSegment(
      track,
      i,
      bounds[k + 1] ?? to,
      starts[k],
      segmentEnd,
      outputAspect,
      camera,
      minCrop,
      group,
      x
    );
    segments.push(segment);
    x = centerAt(segment.x, segmentEnd - 0.001) ?? x;
  });

  const zooms = segments.map((segment) => ({ segment, at: segmentZoom(options, segment, minCrop) }));
  return {
    x: join(segments.map((s) => window(s.x, s.start, s.end))),
    y: join(segments.map((s) => window(s.y, s.start, s.end))),
    heights: join(segments.map((s) => ({ times: [s.start, s.end - 0.001], centers: [s.h, s.h] }))),
    zoomAt: (time) => (zooms.find((z) => time < z.segment.end) ?? zooms[zooms.length - 1]).at(time),
    lift: LIFT,
  };
}
