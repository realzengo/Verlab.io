// AI layouts, OpusClip's "Layouts AI can use": for each shot, picks how a
// 16:9 source fills a vertical or square frame from who is in it, among the
// layouts the user allows, and frames each person in a panel of their own.
//
// A shot where the streamer's face cam shows (see clip-facecam) gets a cam
// layout: Gameplay when the rest of the frame moves a lot, ScreenShare when
// it's a still screen. Otherwise the people seen in most of the shot (not
// passers-by, not faces much smaller than the main one) are counted. Two get
// Split, three get Three, four or more get Four. One person gets Fill
// (following them), nobody gets Fit. When a layout isn't allowed, the next
// best one that is takes its place.

import { findFaceCams, shotFaceCam, type Box, type FaceCam } from "@/lib/client/clip-facecam";
import { centerAt, fillGaps, gaussian, medianFilter, operate } from "@/lib/client/clip-reframe";
import type { CameraMode, CameraPath, ReframeTrack } from "@/lib/client/clip-reframe";

export type LayoutId = "fill" | "fit" | "split" | "three" | "four" | "screen" | "gameplay";
export type PanelLayout = Exclude<LayoutId, "fill" | "fit">;

export const LAYOUTS: { id: LayoutId; label: string }[] = [
  { id: "fill", label: "Fill" },
  { id: "fit", label: "Fit" },
  { id: "split", label: "Split" },
  { id: "three", label: "Three" },
  { id: "four", label: "Four" },
  { id: "screen", label: "ScreenShare" },
  { id: "gameplay", label: "Gameplay" },
];
export const ALL_LAYOUTS = LAYOUTS.map((layout) => layout.id);

/** A rectangle as fractions of the output frame. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * One panel's source crop: its center and height, as fractions of the source
 * frame. With `w`, it's a region the panel fills (cropping to fit) instead.
 */
export interface PanelCrop {
  cx: number;
  cy: number;
  h: number;
  w?: number;
}

/** What one output frame shows: the layout, a crop per panel, and (cam layouts) where the panels meet. */
export interface SceneFrame {
  layout: LayoutId;
  crops: PanelCrop[];
  divide?: number;
}

export const LAYOUT_PANELS: Record<PanelLayout, Rect[]> = {
  split: [
    { x: 0, y: 0, w: 1, h: 0.5 },
    { x: 0, y: 0.5, w: 1, h: 0.5 },
  ],
  three: [
    { x: 0, y: 0, w: 1, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  four: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  // The speaker over their whole screen (fitted, so no text is cut), the face cam over the game.
  screen: [
    { x: 0, y: 0, w: 1, h: 0.55 },
    { x: 0, y: 0.55, w: 1, h: 0.45 },
  ],
  gameplay: [
    { x: 0, y: 0, w: 1, h: 0.4 },
    { x: 0, y: 0.4, w: 1, h: 0.6 },
  ],
};

// How much of its panel's height a face takes, per panel.
const FACE_SHARE: Record<"split" | "three" | "four", number[]> = {
  split: [0.36, 0.36],
  three: [0.36, 0.42, 0.42],
  four: [0.42, 0.42, 0.42, 0.42],
};
// The most a panel zooms in: a third of the source height, so it stays sharp.
const MIN_CROP = 0.32;
// The main person is the most present, biggest face seen in this share of
// the shot's samples. Others count beside them when at least PEER_SIZE of
// their size, detected surely (median score), and in PEER_PRESENCE of the
// shot, or (when nearly as big) at least three times spread over that much
// of it, or (as big and sure) in a fifth of it: a face turned away is missed
// now and then. Background faces, passers-by and false faces (fire,
// patterns) don't get a panel.
const REGULAR = 0.3;
const PEER_SIZE = 0.6;
const PEER_PRESENCE = 0.5;
const PEER_SCORE = 0.7;
// Where no cam is found over the whole clip, a shot's face cam: a face shorter
// than this, within CAM_EDGE of a side and of the top or bottom, holding still
// (spread under CAM_STILL), the only face that keeps coming back.
const CAM_FACE = 0.26;
const CAM_EDGE = 0.32;
const CAM_STILL = 0.04;
// Mean frame change (0-255) above which the rest of the frame reads as gameplay.
const GAMEPLAY_MOTION = 4;

interface PanelPath {
  x: CameraPath;
  y: CameraPath;
  h: number;
  /** A region crop (see PanelCrop). */
  w?: number;
}

interface Shot {
  start: number;
  end: number;
  layout: LayoutId;
  panels: PanelPath[];
  /** Cam layouts: fixed crops after the panels (the game or screen), and where the panels meet. */
  fixed?: PanelCrop[];
  divide?: number;
}

export interface LayoutPlan {
  shots: Shot[];
  /** The layouts the plan actually uses, in order of first use. */
  used: LayoutId[];
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const spread = (values: number[]) => {
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length || 1));
};

interface Person {
  id: number;
  seen: number;
  first: number;
  last: number;
  scores: number[];
  xs: number[];
  ys: number[];
  hs: number[];
  size: number;
}

/** The best allowed layout for a shot's people, or for the streamer when their cam shows in it. */
function chooseLayout(people: Person[], camHere: boolean, motion: number, allowed: Set<LayoutId>): LayoutId {
  const pick = (...order: LayoutId[]) => order.find((id) => allowed.has(id));
  const cam = camHere
    ? motion >= GAMEPLAY_MOTION
      ? pick("gameplay", "screen")
      : pick("screen", "gameplay")
    : undefined;
  const choice =
    cam ??
    (people.length >= 4
      ? pick("four", "three", "split", "fill", "fit")
      : people.length === 3
        ? pick("three", "split", "fill", "fit")
        : people.length === 2
          ? pick("split", "fill", "fit")
          : people.length === 1
            ? pick("fill", "fit")
            : pick("fit", "fill"));
  // Nothing in the chain is allowed (only Gameplay chosen, and no cam in this shot): Fill rather than a
  // game character's face passed off as the streamer.
  return choice ?? "fill";
}

/** Where the streamer's face sits: its center and height, as fractions of the source frame. */
interface FaceSpot {
  x: number;
  y: number;
  size: number;
}

/** Everyone in the cam over a shot: per sample, the middle of their faces (or null), and how far apart they sit. */
interface CamFaces {
  times: number[];
  xs: (number | null)[];
  ys: (number | null)[];
  /** The faces' spread (center to center) when two or more share the cam, as fractions of the source. */
  spreadX: number;
  spreadY: number;
}

// Cam layouts: the cam gets this much of the output's height.
const CAM_SHARE: Record<"gameplay" | "screen", number> = { gameplay: 0.45, screen: 0.5 };
// The streamer, big: the top crop is this many face heights tall (the face
// fills about 40% of the panel), and at least this much of the source, so a
// tiny cam isn't blown up to mush.
const CAM_CROP_FACES = 2.5;
const CAM_CROP_MIN = 0.2;

/**
 * The top panel of a cam layout: a crop of the panel's shape around the
 * streamer's face (everyone in the cam, when they share it), sized from the
 * face and kept inside the cam's visible borders, following them as they
 * move so they always show big.
 */
function camPanel(
  limit: Box,
  spot: FaceSpot,
  faces: CamFaces | null,
  panelAspect: number,
  sourceAspect: number,
  camera: CameraMode,
  end: number
): PanelPath {
  const roomW = limit.x1 - limit.x0;
  const roomH = limit.y1 - limit.y0;
  // Room for everyone: their spread plus a face's margin around them.
  const faceW = (spot.size * 0.8) / sourceAspect;
  const groupH = faces ? faces.spreadY + spot.size * 1.6 : 0;
  const groupW = faces && faces.spreadX > 0 ? ((faces.spreadX + faceW * 2.4) * sourceAspect) / panelAspect : 0;
  let ch = Math.min(roomH, Math.max(CAM_CROP_MIN, spot.size * CAM_CROP_FACES, groupH, groupW));
  let cw = (ch * panelAspect) / sourceAspect;
  if (cw > roomW) {
    cw = roomW;
    ch = (cw * sourceAspect) / panelAspect;
  }
  const clampX = (x: number) => Math.min(limit.x1 - cw / 2, Math.max(limit.x0 + cw / 2, x));
  // The face sits a little above the middle.
  const clampY = (y: number) => Math.min(limit.y1 - ch / 2, Math.max(limit.y0 + ch / 2, y + ch * 0.05));
  if (!faces) {
    return { x: { times: [0], centers: [clampX(spot.x)] }, y: { times: [0], centers: [clampY(spot.y)] }, h: ch, w: cw };
  }
  const xs = gaussian(medianFilter(fillGaps(faces.xs, spot.x), 2), camera === "follow" ? 2 : 3);
  const ys = gaussian(medianFilter(fillGaps(faces.ys, spot.y), 2), 3);
  const x = camera === "follow" ? { times: faces.times, centers: xs } : operate(faces.times, xs, cw, end);
  return {
    x: { times: x.times, centers: x.centers.map(clampX) },
    y: { times: faces.times, centers: (camera === "follow" ? ys : ys.map(() => median(ys))).map(clampY) },
    h: ch,
    w: cw,
  };
}

/**
 * Gameplay's lower panel: the game, full height and centered, moved off the
 * cam (a small nudge, else the rows above or below it, centered, when the
 * cam sits at the top or bottom, else clear of it to the side), so the cam
 * doesn't show twice.
 */
function gameCrop(box: Box, divide: number, sourceAspect: number, outputAspect: number): PanelCrop {
  const panelAspect = outputAspect / (1 - divide);
  const fit = (h: number) => Math.min(1, (panelAspect * h) / sourceAspect);
  const hits = (left: number, width: number) => left < box.x1 && left + width > box.x0;
  const place = (width: number) => {
    let left = 0.5 - width / 2;
    if (box.x1 <= 0.5 && hits(left, width) && box.x1 - left <= 0.15) left = box.x1;
    if (box.x0 >= 0.5 && hits(left, width) && left + width - box.x0 <= 0.15) left = box.x0 - width;
    return left;
  };
  let width = fit(1);
  let left = place(width);
  let y0 = 0;
  let y1 = 1;
  if (hits(left, width) && box.y1 <= 0.45) y0 = box.y1;
  else if (hits(left, width) && box.y0 >= 0.55) y1 = box.y0;
  if (y0 > 0 || y1 < 1) {
    // Above or below the cam already: stay centered on the game.
    width = fit(y1 - y0);
    left = 0.5 - width / 2;
  } else if (hits(left, width)) {
    if (box.x1 <= 0.5 && box.x1 + width <= 1) left = box.x1;
    else if (box.x0 >= 0.5 && box.x0 - width >= 0) left = box.x0 - width;
  }
  return { cx: left + width / 2, cy: (y0 + y1) / 2, h: y1 - y0, w: width };
}

/**
 * ScreenShare's lower panel: the screen without the cam, so it doesn't show
 * twice. When the cam sits against an edge, the band of columns (or rows) it
 * covers is left out, whichever leaves the screen biggest once fitted.
 */
function screenCrop(box: Box, divide: number, sourceAspect: number, outputAspect: number): PanelCrop {
  const panelAspect = outputAspect / (1 - divide);
  const bands: Box[] = [];
  if (box.x0 < 0.12) bands.push({ x0: box.x1, y0: 0, x1: 1, y1: 1 });
  if (box.x1 > 0.88) bands.push({ x0: 0, y0: 0, x1: box.x0, y1: 1 });
  if (box.y0 < 0.12) bands.push({ x0: 0, y0: box.y1, x1: 1, y1: 1 });
  if (box.y1 > 0.88) bands.push({ x0: 0, y0: 0, x1: 1, y1: box.y0 });
  // How big a region shows once fitted into the panel (in panel heights squared).
  const shown = (r: Box) => {
    const w = (r.x1 - r.x0) * sourceAspect;
    const h = r.y1 - r.y0;
    return Math.min(panelAspect / w, 1 / h) ** 2 * w * h;
  };
  // A sliver of a screen isn't worth losing the rest for: the whole frame, cam and all, instead.
  const best = bands.filter((r) => r.x1 - r.x0 >= 0.5 && r.y1 - r.y0 >= 0.5).sort((a, b) => shown(b) - shown(a))[0];
  const region = best ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
  return {
    cx: (region.x0 + region.x1) / 2,
    cy: (region.y0 + region.y1) / 2,
    h: region.y1 - region.y0,
    w: region.x1 - region.x0,
  };
}

/** Whether a face is one of the cam's: inside its box, about the streamer's size. */
const inCam = (cam: FaceCam, face: { x: number; y: number; h: number }) =>
  face.x > cam.box.x0 &&
  face.x < cam.box.x1 &&
  face.y > cam.box.y0 &&
  face.y < cam.box.y1 &&
  face.h > cam.h * 0.5 &&
  face.h < cam.h * 2;

/** The streamer's face over a shot, or where it usually is when it isn't seen (a hand over it, looking away). */
function camSpot(cam: FaceCam, track: ReframeTrack, from: number, to: number): FaceSpot {
  const faces = track.frames.slice(from, to).flatMap((frame) => frame.filter((face) => inCam(cam, face)));
  if (faces.length < 2) return { x: cam.x, y: cam.y, size: cam.h };
  return { x: median(faces.map((f) => f.x)), y: median(faces.map((f) => f.y)), size: median(faces.map((f) => f.h)) };
}

/** Everyone in the cam over a shot (the streamer, and whoever shares the cam with them). */
function camFaces(cam: FaceCam, track: ReframeTrack, from: number, to: number): CamFaces | null {
  const frames = track.frames.slice(from, to).map((frame) => frame.filter((face) => inCam(cam, face)));
  if (frames.every((faces) => !faces.length)) return null;
  const middle = (faces: { x: number; y: number }[], key: "x" | "y") =>
    faces.length ? faces.reduce((sum, f) => sum + f[key], 0) / faces.length : null;
  const shared = frames.filter((faces) => faces.length >= 2);
  const reach = (key: "x" | "y") =>
    shared.length >= frames.length * 0.25
      ? median(shared.map((faces) => Math.max(...faces.map((f) => f[key])) - Math.min(...faces.map((f) => f[key]))))
      : 0;
  return {
    times: track.times.slice(from, to),
    xs: frames.map((faces) => middle(faces, "x")),
    ys: frames.map((faces) => middle(faces, "y")),
    spreadX: reach("x"),
    spreadY: reach("y"),
  };
}

/**
 * The layout per shot and every panel's camera, for an output of
 * `outputAspect` (w/h). Instant: it reads the analysed track, so it reruns
 * whenever the allowed layouts or the format change.
 */
export function layoutPlan(
  track: ReframeTrack,
  { layouts, outputAspect, camera }: { layouts: LayoutId[]; outputAspect: number; camera: CameraMode }
): LayoutPlan {
  const allowed = new Set<LayoutId>(layouts.length ? layouts : ["fill"]);
  const starts = [0, ...track.cuts.flatMap((cut, i) => (cut && i > 0 ? [i] : []))];
  const shots: Shot[] = [];
  // The streamer's cams, where a cam layout may be used: always when the user
  // picked one, and in Auto only for a cam that's clearly an overlay.
  const camLayouts = allowed.has("gameplay") || allowed.has("screen");
  const picked = !(["fill", "fit", "split", "three", "four"] as LayoutId[]).some((id) => allowed.has(id));
  const cams = camLayouts ? findFaceCams(track).filter((cam) => picked || cam.sure) : [];

  starts.forEach((from, s) => {
    const to = starts[s + 1] ?? track.times.length;
    const times = track.times.slice(from, to);
    if (!times.length) return;

    // The people who are really in this shot, most important first.
    const byId = new Map<number, Person>();
    for (let i = from; i < to; i++) {
      for (const face of track.frames[i]) {
        if (face.h < 0.03) continue;
        const person = byId.get(face.id) ?? {
          id: face.id,
          seen: 0,
          first: i,
          last: i,
          scores: [],
          xs: [],
          ys: [],
          hs: [],
          size: 0,
        };
        person.seen++;
        person.last = i;
        person.scores.push(face.score);
        person.xs.push(face.x);
        person.ys.push(face.y);
        person.hs.push(face.h);
        byId.set(face.id, person);
      }
    }
    const candidates = [...byId.values()]
      .filter((p) => p.seen >= 2)
      .map((p) => ({ ...p, size: median(p.hs) }))
      .sort((a, b) => b.seen * b.size - a.seen * a.size);
    const main = candidates[0];
    const n = times.length;
    const people =
      main && main.seen >= n * REGULAR
        ? candidates.filter(
            (p) =>
              p === main ||
              (p.size >= main.size * PEER_SIZE &&
                median(p.scores) >= PEER_SCORE &&
                (p.seen >= n * PEER_PRESENCE ||
                  (p.seen >= 3 && p.last - p.first + 1 >= n * PEER_PRESENCE && p.size >= main.size * 0.7) ||
                  (p.seen >= 3 && p.seen >= n * 0.2 && p.size >= main.size * 0.8 && median(p.scores) >= 0.8)))
          )
        : [];

    const motion = median(track.motion.slice(from + 1, to));
    let cam = cams.find((c) => c.shows.slice(from, to).filter(Boolean).length >= n * 0.5) ?? null;
    if (!cam && camLayouts) {
      const lone = people.length === 1 ? people[0] : null;
      const others = candidates.filter((p) => p !== lone && p.seen >= n * 0.25).length;
      if (
        lone &&
        others === 0 &&
        n >= 6 &&
        lone.size < CAM_FACE &&
        Math.min(median(lone.xs), 1 - median(lone.xs)) < CAM_EDGE &&
        Math.min(median(lone.ys), 1 - median(lone.ys)) < CAM_EDGE + 0.06 &&
        spread(lone.xs) < CAM_STILL &&
        spread(lone.ys) < CAM_STILL
      ) {
        cam = shotFaceCam(track, from, to, lone.id);
      }
    }
    const layout = chooseLayout(people, cam !== null, motion, allowed);

    // Who goes in which panel.
    let cast: Person[] = [];
    if (layout === "split") cast = people.slice(0, 2).sort((a, b) => median(a.xs) - median(b.xs));
    else if (layout === "three") {
      const [lead, ...rest] = people.slice(0, 3);
      cast = [lead, ...rest.sort((a, b) => median(a.xs) - median(b.xs))];
    } else if (layout === "four") cast = people.slice(0, 4).sort((a, b) => median(a.xs) - median(b.xs));

    const end = track.times[to] !== undefined ? track.times[to] : times[times.length - 1] + 1;
    const panels: PanelPath[] = cast.map((person, index) => {
      const rect = LAYOUT_PANELS[layout as PanelLayout][index];
      const panelAspect = (rect.w / rect.h) * outputAspect;
      const h = Math.min(1, Math.max(MIN_CROP, person.size / FACE_SHARE[layout as "split" | "three" | "four"][index]));
      const cropW = Math.min(1, (h * panelAspect) / track.aspect);
      const at = (key: "x" | "y") =>
        track.frames.slice(from, to).map((faces) => faces.find((f) => f.id === person.id)?.[key] ?? null);
      // Faces sit a little above the middle of their panel.
      const ys = gaussian(medianFilter(fillGaps(at("y"), median(person.ys)), 2), 3).map((y) => y + h * 0.08);
      const xs = gaussian(medianFilter(fillGaps(at("x"), median(person.xs)), 2), camera === "follow" ? 2 : 3);
      return {
        x: camera === "follow" ? { times, centers: xs } : operate(times, xs, cropW, end),
        y: { times, centers: camera === "follow" ? ys : ys.map(() => median(ys)) },
        h,
      };
    });

    const shot: Shot = {
      start: s === 0 ? -Infinity : times[0],
      end: s === starts.length - 1 ? Infinity : end,
      layout,
      panels,
    };
    if (cam && (layout === "gameplay" || layout === "screen")) {
      const divide = CAM_SHARE[layout];
      shot.panels = [
        camPanel(
          cam.limit,
          camSpot(cam, track, from, to),
          camFaces(cam, track, from, to),
          outputAspect / divide,
          track.aspect,
          camera,
          end
        ),
      ];
      shot.fixed = [
        layout === "screen"
          ? screenCrop(cam.box, divide, track.aspect, outputAspect)
          : gameCrop(cam.box, divide, track.aspect, outputAspect),
      ];
      shot.divide = divide;
    }
    shots.push(shot);
  });

  const used: LayoutId[] = [];
  for (const shot of shots) if (!used.includes(shot.layout)) used.push(shot.layout);
  return { shots, used };
}

/** What the output shows at `time`. */
export function sceneAt(plan: LayoutPlan | null | undefined, time: number): SceneFrame | null {
  if (!plan?.shots.length) return null;
  const shot = plan.shots.find((s) => time >= s.start && time < s.end) ?? plan.shots[plan.shots.length - 1];
  const crops: PanelCrop[] = shot.panels.map((panel) => ({
    cx: centerAt(panel.x, time) ?? 0.5,
    cy: centerAt(panel.y, time) ?? 0.5,
    h: panel.h,
    ...(panel.w !== undefined ? { w: panel.w } : {}),
  }));
  if (shot.fixed) crops.push(...shot.fixed);
  return { layout: shot.layout, crops, divide: shot.divide };
}
