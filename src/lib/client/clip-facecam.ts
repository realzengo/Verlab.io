// The streamer's face cam, for the Gameplay and ScreenShare layouts: which
// face is the streamer's (not a game character's, however big or central),
// the cam's rectangle around it, and when it shows.
//
// A face cam is an overlay. It sits in the same place for the whole clip,
// across the game's cuts, and the room in it doesn't move when the game does.
// So faces are gathered by where they sit over the whole clip, and each spot
// is scored on how cam-like it is:
//  - calm: when the game moves (the rest of the frame changes a lot), the
//    pixels around a cam face barely change, while those around a game face
//    move with the game;
//  - placement: cams sit near an edge or a corner, game faces mostly don't;
//  - size: a face filling half the frame is a cutscene, not a cam;
//  - presence over the clip.
// A face only counts when that's clear: calm measured while the game's camera
// moves, or the same spot by an edge for most of the clip.
//
// Around the winning face, each side of the cam is where a persistent edge
// (the overlay's border stays put while the game changes) or a step from calm
// (the cam) to busy (the game) stands out along its whole length, picked
// together as the rectangle that also looks most like a cam (its shape, the
// face's place in it). A side that doesn't show (a dark shirt over a dark
// corner of the game) falls back to a typical cam's size around the face.
//
// Then, per shot, the cam shows when a face like the streamer's is in it, its
// borders show, or the box looks like it usually does (an inserted meme or a
// zoom on the cam has none of these). An edit that moves or resizes the cam
// gets another one, for the shots the first doesn't show in.

import { LUMA_H, LUMA_W, type ReframeTrack } from "@/lib/client/clip-reframe";

/** A rectangle by its edges, as fractions of the source frame. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface FaceCam {
  /** The streamer's face: its usual center and height, as fractions of the source frame. */
  x: number;
  y: number;
  h: number;
  /** The cam's sides that clearly show (just inside them), else the estimate: the top crop stays inside these. */
  limit: Box;
  /** A best estimate of the whole cam (its sides that show, the rest sized from the face). */
  box: Box;
  /** Clearly an overlay, not just a face near a corner: AI layouts only use a sure cam. */
  sure: boolean;
  /** Per sample: whether the cam shows. */
  shows: boolean[];
}

const W = LUMA_W;
const H = LUMA_H;

// A spot needs this share of the samples (and at least 3) to be a candidate.
const MIN_PRESENCE = 0.04;
// Below this cam score nothing is a cam.
const MIN_SCORE = 0.15;
// At most this many cams per clip (an edit can move or resize the cam).
const MAX_CAMS = 3;
// The most of the frame a cam overlay covers.
const MAX_CAM_AREA = 0.36;
// Calm: around a cam face, the change during the game's busiest moments is at
// most this share of the change elsewhere (around a game face it's about 1).
const SURE_CALM = 0.45;
// The game moves (its camera turns) when this share of the frame changes by more than MOVED (0-255).
const MOVED_SHARE = 0.25;
const MOVED = 4;
// A side shows when its edge and motion step stand out this far from the noise.
const SIDE_SEEN = 2.4;
// What a side flush with the frame's edge counts for: as plausible as a faint border.
const FRAME_SIDE = 2;
// Mean change (0-255) when the game moves, above which the game counts as busy.
const BUSY_GAME = 1.5;

let scratch = new Float64Array(256);
/** The k-th smallest of `values` (0-based), by quickselect on a scratch copy: this runs per pixel. */
function select(values: ArrayLike<number>, k: number): number {
  const n = values.length;
  if (!n) return 0;
  if (scratch.length < n) scratch = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) scratch[i] = values[i];
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const pivot = scratch[(lo + hi) >> 1];
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (scratch[i] < pivot) i++;
      while (scratch[j] > pivot) j--;
      if (i <= j) {
        const t = scratch[i];
        scratch[i++] = scratch[j];
        scratch[j--] = t;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else break;
  }
  return scratch[k];
}
const median = (values: ArrayLike<number>) => select(values, values.length >> 1);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Intersection over union of two boxes. */
const overlap = (a: Box, b: Box) => {
  const shared =
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const area = (r: Box) => (r.x1 - r.x0) * (r.y1 - r.y0);
  return shared / (area(a) + area(b) - shared || 1);
};

/** Faces seen in the same place (and at about the same size) over the whole clip. */
interface Spot {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The samples it's seen in, in order. */
  samples: number[];
}

function gatherSpots(track: ReframeTrack): Spot[] {
  const spots: (Spot & { xs: number[]; ys: number[]; ws: number[]; hs: number[] })[] = [];
  track.frames.forEach((faces, i) => {
    for (const face of faces) {
      if (face.h < 0.03) continue;
      let best: (typeof spots)[number] | null = null;
      let bestDistance = 0.9;
      for (const spot of spots) {
        if (face.h < spot.h * 0.6 || face.h > spot.h * 1.65) continue;
        const distance = Math.hypot((face.x - spot.x) * track.aspect, face.y - spot.y) / Math.max(face.h, spot.h);
        if (distance < bestDistance) {
          best = spot;
          bestDistance = distance;
        }
      }
      if (!best) {
        best = { x: face.x, y: face.y, w: face.w, h: face.h, samples: [], xs: [], ys: [], ws: [], hs: [] };
        spots.push(best);
      }
      if (best.samples[best.samples.length - 1] !== i) best.samples.push(i);
      best.xs.push(face.x);
      best.ys.push(face.y);
      best.ws.push(face.w);
      best.hs.push(face.h);
      // A running mean while gathering, so a spot follows a face that drifts a little.
      const n = best.xs.length;
      best.x += (face.x - best.x) / n;
      best.y += (face.y - best.y) / n;
      best.h += (face.h - best.h) / n;
    }
  });
  return spots.map((s) => ({ x: median(s.xs), y: median(s.ys), w: median(s.ws), h: median(s.hs), samples: s.samples }));
}

/** Mean absolute change between two luma frames over a box (luma pixels), leaving out `hole`. */
function change(a: Uint8Array, b: Uint8Array, box: number[], hole?: number[]): number {
  const [x0, y0, x1, y1] = box.map(Math.round);
  let sum = 0;
  let n = 0;
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      if (hole && x >= hole[0] && x < hole[2] && y >= hole[1] && y < hole[3]) continue;
      sum += Math.abs(a[y * W + x] - b[y * W + x]);
      n++;
    }
  }
  return n ? sum / n : 0;
}

/** The share of pixels outside `hole` that changed visibly between two luma frames. */
function movedShare(a: Uint8Array, b: Uint8Array, hole: number[]): number {
  const [x0, y0, x1, y1] = hole.map(Math.round);
  let moved = 0;
  let n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= x0 && x < x1 && y >= y0 && y < y1) continue;
      if (Math.abs(a[y * W + x] - b[y * W + x]) > MOVED) moved++;
      n++;
    }
  }
  return n ? moved / n : 0;
}

/** Samples within a few of the spot's detections: where it (most likely) shows. */
function around(spot: Spot, count: number, reach = 4): number[] {
  const near = new Uint8Array(count);
  for (const i of spot.samples) near.fill(1, Math.max(0, i - reach), Math.min(count, i + reach + 1));
  return [...near.keys()].filter((k) => near[k]);
}

/**
 * How much the pixels around the face change during the game's busiest
 * moments, as a share of the change elsewhere: about 1 for a face in the
 * game, near 0 for a cam. Only moments when most of the frame changes count
 * (the game's camera moving): in a still cutscene where someone else moves,
 * a character holding still would pass for a cam. Null when the game never
 * moves like that (or the face fills the frame), so there's nothing to tell by.
 */
function calmness(luma: (Uint8Array | null)[], spot: Spot): number | null {
  const fx = spot.x * W;
  const fy = spot.y * H;
  const fw = Math.max(2, spot.w * W);
  const fh = Math.max(2, spot.h * H);
  const face = [fx - 0.55 * fw, fy - 0.6 * fh, fx + 0.55 * fw, fy + 0.6 * fh];
  const ring = [fx - 1.3 * fw, fy - 1.1 * fh, fx + 1.3 * fw, fy + 1.4 * fh];
  const near = [fx - 3 * fw, fy - 3 * fh, fx + 3 * fw, fy + 3 * fh];
  const nearArea = (Math.min(W, near[2]) - Math.max(0, near[0])) * (Math.min(H, near[3]) - Math.max(0, near[1]));
  if (nearArea > W * H * 0.75) return null;
  const pairs: [number, number][] = [];
  for (const k of around(spot, luma.length)) {
    const a = luma[k];
    const b = luma[k - 1];
    if (!a || !b) continue;
    const elsewhere = change(a, b, [0, 0, W, H], near);
    // Still frames say nothing; a change this big is an edit (the whole frame swapped).
    if (elsewhere < 2 || elsewhere > 40 || movedShare(a, b, near) < MOVED_SHARE) continue;
    pairs.push([elsewhere, change(a, b, ring, face)]);
  }
  pairs.sort((p, q) => q[0] - p[0]);
  const busiest = pairs.slice(0, Math.floor(pairs.length / 2));
  return busiest.length >= 4 ? median(busiest.map(([elsewhere, ring]) => ring / elsewhere)) : null;
}

/** A side of the cam: its position (luma pixels, the boundary before that pixel), and whether it shows. */
interface Side {
  at: number;
  score: number;
  frame: boolean;
}

/** A side of the cam that clearly shows: its position and span, in luma pixels. */
interface Border {
  at: number;
  vertical: boolean;
  from: number;
  to: number;
}

/** A typical head-and-shoulders 16:9 cam around a face, for sides that don't show. */
function estimate(spot: Spot, aspect: number): Box {
  const halfW = (2.7 * spot.h) / aspect;
  // A side within a face's height of the frame's edge is most likely on it.
  const snap = (value: number, edge: number, size: number) => (Math.abs(value - edge) < size ? edge : value);
  return {
    x0: Math.max(0, snap(spot.x - halfW, 0, spot.h / aspect)),
    x1: Math.min(1, snap(spot.x + halfW, 1, spot.h / aspect)),
    y0: Math.max(0, snap(spot.y - 1.3 * spot.h, 0, spot.h)),
    y1: Math.min(1, snap(spot.y + 2.2 * spot.h, 1, spot.h)),
  };
}

/**
 * The cam's rectangle around the streamer's face, from luma frames where it
 * shows and pairs of consecutive ones (for motion).
 */
function findBox(
  frames: Uint8Array[],
  pairs: [Uint8Array, Uint8Array][],
  spot: Spot,
  aspect: number
): { box: Box; limit: Box; borders: Border[] } {
  const fx = spot.x * W;
  const fy = spot.y * H;
  const fw = Math.max(2, spot.w * W);
  const fh = Math.max(3, spot.h * H);
  const c0 = Math.max(1, Math.floor(fx - 7 * fw));
  const c1 = Math.min(W - 2, Math.ceil(fx + 7 * fw));
  const r0 = Math.max(1, Math.floor(fy - 4 * fh));
  const r1 = Math.min(H - 2, Math.ceil(fy + 6 * fh));

  // Per pixel: the luminance step to each side, at its median over the frames
  // (the overlay's border stays put while the game changes), and how much it
  // changes when the game moves.
  const stepX = new Float32Array(W * H);
  const stepY = new Float32Array(W * H);
  const busy = new Float32Array(W * H);
  const values: number[] = [];
  const steps: number[] = [];
  const busyAll: number[] = [];
  const busyAway: number[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const i = r * W + c;
      values.length = 0;
      for (const l of frames) values.push(Math.abs(l[i + 1] - l[i - 1]) / 2);
      stepX[i] = median(values);
      values.length = 0;
      for (const l of frames) values.push(Math.abs(l[i + W] - l[i - W]) / 2);
      stepY[i] = median(values);
      values.length = 0;
      for (const [a, b] of pairs) values.push(Math.abs(a[i] - b[i]));
      busy[i] = median(values);
      if ((r + c) % 3 === 0) {
        steps.push(stepX[i], stepY[i]);
        busyAll.push(busy[i]);
        if (Math.abs(c - fx) > 3.5 * fw || r < fy - 2.5 * fh || r > fy + 4 * fh) busyAway.push(busy[i]);
      }
    }
  }
  const noise = median(steps) + 0.75;
  const busyNoise = median(busyAll) + 0.5;
  // How much the game around the cam moves. When it's busy, an edge with calm on both sides (a door frame
  // behind the streamer) is inside the cam, not its border.
  const gameBusy = busyAway.length >= 30 ? median(busyAway) : 0;
  /**
   * How clearly a side shows, from each pixel along it: its edge and its step
   * from calm to busy. A border runs straight along the whole cam, so this is
   * how strong it is along most of its length (a head's outline beside the
   * face only covers part of it), allowing for stretches where it can't be
   * seen.
   */
  const strength = (edges: number[], steps: number[], beyond: number[]) => {
    if (!edges.length) return 0;
    const calm = (k: number) => gameBusy >= BUSY_GAME && beyond[k] < gameBusy * 0.35;
    const each = edges.map((e, k) => (e / noise) * (calm(k) ? 0.35 : 1) + Math.max(0, steps[k] / busyNoise));
    return select(each, Math.floor(each.length * 0.4));
  };
  const at = (c: number, r: number) => Math.min(W - 1, Math.max(0, c)) + Math.min(H - 1, Math.max(0, r)) * W;

  /** A vertical side at boundary `b` over rows ra..rb; `out` is the direction away from the cam. */
  const column = (b: number, ra: number, rb: number, out: 1 | -1) => {
    if (b <= 1 || b >= W - 1) return 0;
    const edges: number[] = [];
    const steps: number[] = [];
    const beyond: number[] = [];
    for (let r = Math.max(1, ra); r <= Math.min(H - 2, rb); r++) {
      const outside = out > 0 ? [b + 1, b + 2] : [b - 2, b - 3];
      const inside = out > 0 ? [b - 2, b - 3] : [b + 1, b + 2];
      const away = (busy[at(outside[0], r)] + busy[at(outside[1], r)]) / 2;
      edges.push(Math.max(stepX[at(b - 1, r)], stepX[at(b, r)]));
      steps.push(away - (busy[at(inside[0], r)] + busy[at(inside[1], r)]) / 2);
      beyond.push(away);
    }
    return strength(edges, steps, beyond);
  };
  /** A horizontal side at boundary `b` over columns ca..cb. */
  const row = (b: number, ca: number, cb: number, out: 1 | -1) => {
    if (b <= 1 || b >= H - 1) return 0;
    const edges: number[] = [];
    const steps: number[] = [];
    const beyond: number[] = [];
    for (let c = Math.max(1, ca); c <= Math.min(W - 2, cb); c++) {
      const outside = out > 0 ? [b + 1, b + 2] : [b - 2, b - 3];
      const inside = out > 0 ? [b - 2, b - 3] : [b + 1, b + 2];
      const away = (busy[at(c, outside[0])] + busy[at(c, outside[1])]) / 2;
      edges.push(Math.max(stepY[at(c, b - 1)], stepY[at(c, b)]));
      steps.push(away - (busy[at(c, inside[0])] + busy[at(c, inside[1])]) / 2);
      beyond.push(away);
    }
    return strength(edges, steps, beyond);
  };

  /**
   * Where a side could be: standing-out peaks between `near` and `far`, the
   * frame's edge (when it's within `reach` of `near`, as far as a cam's side
   * could be from the face), or unseen (`guess`).
   */
  const candidates = (
    near: number,
    far: number,
    edge: number,
    reach: number,
    guess: number,
    score: (b: number) => number
  ) => {
    const dir = far >= near ? 1 : -1;
    const profile: { at: number; score: number }[] = [];
    for (let b = Math.round(near); dir > 0 ? b <= far : b >= far; b += dir) profile.push({ at: b, score: score(b) });
    const floor = Math.max(SIDE_SEEN * 0.8, median(profile.map((p) => p.score)) * 1.6);
    const peaks = profile
      .filter(
        (p, k) => p.score >= floor && p.score >= (profile[k - 1]?.score ?? 0) && p.score >= (profile[k + 1]?.score ?? 0)
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    const sides: Side[] = peaks.map((p) => ({ ...p, frame: false }));
    if (Math.abs(edge - near) <= reach) sides.push({ at: edge, score: FRAME_SIDE, frame: true });
    sides.push({ at: Math.round(guess), score: 0, frame: false });
    return sides;
  };
  // Luma pixels are square only for a 16:9 source.
  const pixelAspect = aspect / (W / H);
  const faceRows = [Math.round(fy - 0.5 * fh), Math.round(fy + 0.8 * fh)];
  const faceCols = [Math.round(fx - 1.2 * fw), Math.round(fx + 1.2 * fw)];
  const guess = estimate(spot, aspect);
  const reachX = (3.6 * fh) / pixelAspect;
  const lefts = candidates(fx - 0.55 * fw, c0, 0, reachX, guess.x0 * W, (b) => column(b, faceRows[0], faceRows[1], -1));
  const rights = candidates(fx + 0.55 * fw, c1 + 1, W, reachX, guess.x1 * W, (b) =>
    column(b, faceRows[0], faceRows[1], 1)
  );
  const tops = candidates(fy - 0.5 * fh, r0, 0, 2.2 * fh, guess.y0 * H, (b) => row(b, faceCols[0], faceCols[1], -1));
  const bottoms = candidates(fy + 0.6 * fh, r1 + 1, H, 4 * fh, guess.y1 * H, (b) =>
    row(b, faceCols[0], faceCols[1], 1)
  );

  // Every combination, each side scored along its exact span, plus how much it looks like a cam.
  let best: { score: number; sides: [Side, Side, Side, Side] } | null = null;
  for (const left of lefts) {
    for (const right of rights) {
      if (right.at - left.at < 1.5 * fw) continue;
      for (const top of tops) {
        for (const bottom of bottoms) {
          if (bottom.at - top.at < 1.3 * fh) continue;
          const span = (side: Side, score: () => number) => (side.frame ? FRAME_SIDE : side.score > 0 ? score() : 0);
          const sides: [Side, Side, Side, Side] = [
            { ...left, score: span(left, () => column(left.at, top.at + 1, bottom.at - 2, -1)) },
            { ...right, score: span(right, () => column(right.at, top.at + 1, bottom.at - 2, 1)) },
            { ...top, score: span(top, () => row(top.at, left.at + 1, right.at - 2, -1)) },
            { ...bottom, score: span(bottom, () => row(bottom.at, left.at + 1, right.at - 2, 1)) },
          ];
          // A border claimed where it doesn't show along this rectangle's side (only where it trims the
          // others to their strongest stretch) isn't one: that side is the frame's edge or unseen instead.
          if (
            sides.some((side, k) => !side.frame && [left, right, top, bottom][k].score > 0 && side.score < SIDE_SEEN)
          ) {
            continue;
          }
          const ratio = ((right.at - left.at) / (bottom.at - top.at)) * pixelAspect;
          const shape = Math.max(
            ...[16 / 9, 4 / 3, 1].map((a) => Math.exp(-(Math.log(ratio / a) ** 2) / (2 * 0.15 ** 2)))
          );
          const u = (fx - left.at) / (right.at - left.at);
          const v = (fy - top.at) / (bottom.at - top.at);
          const placed =
            clamp01(1 - Math.max(0, Math.abs(u - 0.5) - 0.3) / 0.2) * clamp01(1 - Math.max(0, 0.15 - v, v - 0.7) / 0.2);
          const share = fh / (bottom.at - top.at);
          const sized = clamp01(1 - Math.max(0, 0.15 - share, share - 0.75) / 0.15);
          const score = sides.reduce((sum, s) => sum + Math.min(s.score, 12), 0) + 2 * shape + 2 * placed + sized;
          if (!best || score > best.score) best = { score, sides };
        }
      }
    }
  }
  if (!best) return { box: guess, limit: guess, borders: [] };
  const sides = best.sides;
  const shows = (side: Side) => side.frame || side.score >= SIDE_SEEN;
  const [left, right, top, bottom] = sides;
  // A pixel inside a border that shows, clear of its blur; an unseen side keeps the estimate from the face.
  const inset = (side: Side) => (shows(side) && !side.frame ? 1 : 0);
  return {
    box: { x0: left.at / W, x1: right.at / W, y0: top.at / H, y1: bottom.at / H },
    limit: {
      x0: (left.at + inset(left)) / W,
      x1: (right.at - inset(right)) / W,
      y0: (top.at + inset(top)) / H,
      y1: (bottom.at - inset(bottom)) / H,
    },
    borders: (
      [
        [left, { at: left.at, vertical: true, from: top.at + 1, to: bottom.at - 2 }],
        [right, { at: right.at, vertical: true, from: top.at + 1, to: bottom.at - 2 }],
        [top, { at: top.at, vertical: false, from: left.at + 1, to: right.at - 2 }],
        [bottom, { at: bottom.at, vertical: false, from: left.at + 1, to: right.at - 2 }],
      ] as [Side, Border][]
    )
      .filter(([side]) => shows(side) && !side.frame)
      .map(([, border]) => border),
  };
}

/** The luminance step across a border at each pixel along it, at its median over `frames`. */
function borderSteps(frames: Uint8Array[], border: Border): number[] {
  const steps: number[] = [];
  const values: number[] = [];
  for (let k = Math.max(1, border.from); k <= Math.min((border.vertical ? H : W) - 2, border.to); k++) {
    values.length = 0;
    const b = border.at;
    for (const l of frames) {
      const at = (offset: number) => (border.vertical ? l[k * W + b + offset] : l[(b + offset) * W + k]);
      values.push(Math.max(Math.abs(at(0) - at(-2)), Math.abs(at(1) - at(-1))) / 2);
    }
    steps.push(median(values));
  }
  return steps;
}

/**
 * Per sample, whether the cam shows: per shot, a face like the streamer's in
 * the box, the cam's borders where they were found, or the box's usual look
 * (its median over the shot against its median where the streamer is seen).
 * A zoom on the cam or an inserted clip has none of these.
 */
function camShows(track: ReframeTrack, spot: Spot, box: Box, borders: Border[]): boolean[] {
  // The streamer's face in the box, and whole inside the borders that show (give or take a quarter of it,
  // for the detector's jitter): a zoom on the cam shows a bigger face reaching past where they were.
  const reaches = (face: { x: number; y: number; w: number; h: number }, border: Border) => {
    const [center, half] = border.vertical ? [face.x * W, (face.w * W) / 4] : [face.y * H, (face.h * H) / 4];
    const middle = border.vertical ? ((box.x0 + box.x1) / 2) * W : ((box.y0 + box.y1) / 2) * H;
    return border.at > middle ? center + half > border.at : center - half < border.at;
  };
  const inside = (face: { x: number; y: number; w: number; h: number }) =>
    face.x > box.x0 &&
    face.x < box.x1 &&
    face.y > box.y0 &&
    face.y < box.y1 &&
    face.h > spot.h * 0.6 &&
    face.h < spot.h * 1.6 &&
    !borders.some((border) => reaches(face, border));
  const cx0 = Math.max(0, Math.round(box.x0 * W) + 1);
  const cx1 = Math.min(W, Math.round(box.x1 * W) - 1);
  const cy0 = Math.max(0, Math.round(box.y0 * H) + 1);
  const cy1 = Math.min(H, Math.round(box.y1 * H) - 1);
  const pixels: number[] = [];
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) pixels.push(y * W + x);
  const medianImage = (samples: number[]) => {
    const frames = samples.map((i) => track.luma[i]).filter((l): l is Uint8Array => l !== null);
    const every = Math.max(1, Math.floor(frames.length / 24));
    const picked = frames.filter((_, k) => k % every === 0);
    return picked.length ? pixels.map((p) => median(picked.map((l) => l[p]))) : null;
  };
  const template = medianImage(spot.samples);
  const spreadOf = (image: number[]) => {
    const mean = image.reduce((a, b) => a + b, 0) / (image.length || 1);
    return image.reduce((a, b) => a + Math.abs(b - mean), 0) / (image.length || 1);
  };
  const templateSpread = template ? spreadOf(template) : 0;

  /** Whether most of the cam's borders show over these frames, against the steps inside the box. */
  const bordered = (frames: Uint8Array[]) => {
    if (!borders.length || !frames.length) return false;
    const inner: number[] = [];
    for (let k = 0; k < pixels.length; k += 3) {
      const p = pixels[k];
      inner.push(median(frames.map((l) => Math.abs(l[p + 1] - l[p - 1]) / 2)));
    }
    const noise = median(inner) + 0.75;
    const along = (border: Border) => {
      const steps = borderSteps(frames, border);
      return select(steps, Math.floor(steps.length * 0.4));
    };
    // A border stands out from the lines beside it; in a busy picture every line is as strong.
    const showing = borders.filter((border) => {
      const strength = along(border);
      const limit = border.vertical ? W : H;
      const beside = [-5, -3, 3, 5]
        .map((d) => border.at + d)
        .filter((at) => at >= 2 && at <= limit - 2)
        .map((at) => along({ ...border, at }));
      return strength / noise >= SIDE_SEEN && strength >= 2 * median(beside);
    }).length;
    // All of them, or with three or four, all but one (the game can match the cam's color along one).
    return showing >= borders.length - (borders.length >= 3 ? 1 : 0);
  };

  const shows = track.times.map(() => false);
  const starts = [0, ...track.cuts.flatMap((cut, i) => (cut && i > 0 ? [i] : []))];
  starts.forEach((from, s) => {
    const to = starts[s + 1] ?? track.times.length;
    const samples = Array.from({ length: to - from }, (_, k) => from + k);
    let here = samples.filter((i) => track.frames[i].some(inside)).length >= samples.length * 0.25;
    if (!here) {
      const frames = samples.map((i) => track.luma[i]).filter((l): l is Uint8Array => l !== null);
      const every = Math.max(1, Math.floor(frames.length / 16));
      here = bordered(frames.filter((_, k) => k % every === 0));
    }
    if (!here && template && pixels.length) {
      const image = medianImage(samples);
      if (image) {
        const diff = image.reduce((sum, v, k) => sum + Math.abs(v - template[k]), 0) / image.length;
        here = diff < 0.6 * (templateSpread + 6);
      }
    }
    if (here) for (const i of samples) shows[i] = true;
  });
  return shows;
}

const cache = new WeakMap<ReframeTrack, FaceCam[]>();

/**
 * The streamer's face cams in a clip, best first: usually one, more when an
 * edit moves or resizes it (a compilation, a zoom on the streamer). Empty when
 * no face looks like a cam's. Cached per track.
 */
export function findFaceCams(track: ReframeTrack): FaceCam[] {
  const cached = cache.get(track);
  if (cached) return cached;
  const result = detect(track);
  cache.set(track, result);
  return result;
}

function detect(track: ReframeTrack): FaceCam[] {
  const count = track.times.length;
  if (!count || !track.luma.some(Boolean)) return [];

  const scored = gatherSpots(track)
    .filter((spot) => spot.samples.length >= Math.max(3, count * MIN_PRESENCE))
    .map((spot) => {
      const edge = Math.min(spot.x, 1 - spot.x, spot.y, 1 - spot.y);
      const placement = clamp01((0.36 - edge) / 0.12);
      const size = clamp01((0.45 - spot.h) / 0.15);
      const calm = placement && size ? calmness(track.luma, spot) : null;
      const calmScore = calm === null ? 0.6 : Math.min(1, Math.max(0.1, (1.1 - calm) / 0.75));
      const presence = Math.sqrt(Math.min(1, spot.samples.length / (count * 0.4)));
      // In the same spot by an edge for most of the clip: a game character rarely holds still that long.
      const steady = spot.samples.length >= count * 0.4 && edge <= 0.22;
      return { spot, calm, steady, score: placement * size * calmScore * presence };
    })
    .sort((a, b) => b.score - a.score);

  const cams: FaceCam[] = [];
  for (const candidate of scored) {
    if (candidate.score < MIN_SCORE || cams.length === MAX_CAMS) break;
    const { spot, calm, steady } = candidate;
    // Another cam is for where the ones found don't show (an edit moved or resized it): a face seen mostly
    // where one does is that cam's (the streamer leaning in, a face on a poster behind them).
    if (
      cams.length &&
      spot.samples.filter((i) => !cams.some((cam) => cam.shows[i])).length < spot.samples.length * 0.5
    ) {
      continue;
    }

    // The old rule for a sure cam still holds: the only face that keeps coming back, small, still and in a corner.
    const lone =
      !cams.length &&
      scored.filter((s) => s !== candidate && s.spot.samples.length >= count * 0.25).length === 0 &&
      spot.h < 0.26 &&
      Math.min(spot.x, 1 - spot.x) < 0.32 &&
      Math.min(spot.y, 1 - spot.y) < 0.38 &&
      spot.samples.length >= count * 0.3;
    // Not clearly an overlay (a game character near a corner), unless it's the steady first one: past the
    // first, only a sure cam. Calm settles it before the box is looked for; borders can add to it below.
    const calmEnough = calm !== null && calm <= 0.7;
    if (!calmEnough && !lone && (cams.length || !steady)) continue;

    // The cam's box, from where it shows: the samples around the streamer's face.
    const near = around(spot, count);
    const frames = near.map((i) => track.luma[i]).filter((l): l is Uint8Array => l !== null);
    const pairs: [Uint8Array, Uint8Array][] = [];
    for (const k of near) {
      const a = track.luma[k];
      const b = track.luma[k - 1];
      if (!a || !b) continue;
      const elsewhere = change(a, b, [0, 0, W, H]);
      if (elsewhere > 1.5 && elsewhere < 40) pairs.push([a, b]);
    }
    const every = (list: unknown[]) => Math.max(1, Math.floor(list.length / 48));
    let { box, limit, borders } = findBox(
      frames.filter((_, k) => k % every(frames) === 0),
      pairs.filter((_, k) => k % every(pairs) === 0),
      spot,
      track.aspect
    );
    // A "cam" covering much of the frame isn't an overlay. Its borders may just not show (black on black):
    // a face that holds calm while the game moves is still a cam, sized from the face.
    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    if (w * h > MAX_CAM_AREA || w > 0.62 || h > 0.75) {
      if (calm === null || calm > SURE_CALM) continue;
      box = limit = estimate(spot, track.aspect);
      borders = [];
    }
    if (cams.some((cam) => overlap(cam.box, box) > 0.7)) continue;

    // Borders alone say little when the game holds still too (every edge in a still scene stays put).
    const sure = (calm !== null && (calm <= SURE_CALM || (calmEnough && borders.length >= 2))) || lone;
    if (!sure && (cams.length || !steady)) continue;
    cams.push({ x: spot.x, y: spot.y, h: spot.h, limit, box, sure, shows: camShows(track, spot, box, borders) });
  }
  return cams;
}

/**
 * A cam for one shot, around a face that looks like a cam's there (the only
 * one, small, still, in a corner; the caller decides): for a cam that shows
 * too briefly to be found over the whole clip, like a reel cut from several
 * streams.
 */
export function shotFaceCam(track: ReframeTrack, from: number, to: number, id: number): FaceCam | null {
  const seen = track.frames.slice(from, to).flatMap((faces, k) => {
    const face = faces.find((f) => f.id === id);
    return face ? [{ ...face, sample: from + k }] : [];
  });
  if (seen.length < 3) return null;
  const spot: Spot = {
    x: median(seen.map((f) => f.x)),
    y: median(seen.map((f) => f.y)),
    w: median(seen.map((f) => f.w)),
    h: median(seen.map((f) => f.h)),
    samples: seen.map((f) => f.sample),
  };
  const frames: Uint8Array[] = [];
  const pairs: [Uint8Array, Uint8Array][] = [];
  for (let i = from; i < to; i++) {
    const a = track.luma[i];
    if (!a) continue;
    frames.push(a);
    const b = i > from ? track.luma[i - 1] : null;
    if (b && change(a, b, [0, 0, W, H]) > 1.5) pairs.push([a, b]);
  }
  let { box, limit } = findBox(frames, pairs, spot, track.aspect);
  if ((box.x1 - box.x0) * (box.y1 - box.y0) > MAX_CAM_AREA) box = limit = estimate(spot, track.aspect);
  const shows = track.times.map((_, i) => i >= from && i < to);
  return { x: spot.x, y: spot.y, h: spot.h, limit, box, sure: true, shows };
}
