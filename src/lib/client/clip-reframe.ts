// AI reframe: follows the person who matters across a clip so a 16:9 source
// can be cropped to 9:16 (or 1:1) without losing them -- OpusClip's headline
// feature, done in the browser with MediaPipe.
//
// Analysis runs once per clip. Frames are sampled every SAMPLE_EVERY seconds.
// BlazeFace runs on the whole frame and, when the faces it finds are small,
// again on three overlapping square tiles at nearly twice the zoom, so wide
// shots still find people. That full search runs now and then; in between,
// the faces already found are followed with a tile on each, a fraction of the
// detector calls. A pool of workers reads the clip in pieces at once (see
// readFrames), so a minute of video tracks in seconds, off the editor's
// thread. Detections are linked into identities from one
// sample to the next. When two or more people share a shot, the face
// landmarker reads each mouth, and the person whose jaw is moving (talking)
// is followed. A new speaker has to lead for a moment, and the switch is
// then placed where their lead began, so the cut lands as they start
// talking. A shot change is a sharp spike in frame difference against its
// neighbours, so handheld moves and animated graphics don't count as cuts.
//
// The camera is computed per settings, instantly: cameraPath() turns the
// subject track into a path. "smooth" behaves like a camera operator: it
// holds still while the subject stays near the middle of the crop, and makes
// short eased pans when they leave it, starting a beat early because the
// whole clip is known. "follow" tracks continuously through a soft filter.
// Shot changes and speaker switches are hard cuts.

import type { ClipSource } from "@/lib/client/clip-render";

/** Who to follow, sampled over source time. */
export interface ReframeTrack {
  /** Width / height of the analysed video. */
  aspect: number;
  /** The source's own height in pixels: how far a crop can zoom before it goes soft. */
  height?: number;
  times: number[];
  /** Horizontal center of the subject (0 = left edge, 1 = right edge), or null if not seen. */
  subject: (number | null)[];
  /** The camera cuts here: a shot change or a speaker switch. */
  breaks: boolean[];
  /** Most faces seen in one frame, and how many times the speaker changed. */
  faces: number;
  switches: number;
  /** Every face per sample (centers and sizes, 0-1), linked into people; ids hold within a shot. */
  frames: { id: number; x: number; y: number; w: number; h: number; score: number }[][];
  /** Shot changes only (breaks also mark speaker switches). */
  cuts: boolean[];
  /** How much the frame changed since the previous sample (0-255). */
  motion: number[];
  /** A small grayscale copy of each sample (LUMA_W x LUMA_H), for finding a face cam's box. */
  luma: (Uint8Array | null)[];
}

export const LUMA_W = 192;
export const LUMA_H = 108;

/** The camera's horizontal center over source time. */
export interface CameraPath {
  times: number[];
  centers: number[];
}

export type CameraMode = "smooth" | "follow";

const MEDIAPIPE_VERSION = "1.2.2";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const DETECTOR_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const LANDMARKER_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const SAMPLE_EVERY = 0.15;
const ANALYSIS_WIDTH = 960;
// A cut: mean luminance change (0-255) above this, standing out from the
// change around it by SPIKE (or above HARD_CUT outright), at most once per MIN_SHOT.
const SHOT_CHANGE = 26;
const SPIKE = 2.2;
const HARD_CUT = 70;
const MIN_SHOT = 0.6;
// BlazeFace sees the image at 128px, so it misses small faces. Every frame
// also goes through three full-height square tiles; every DEEP_EVERY-th one
// (or any with nothing over TINY_FACE) through twelve half-height tiles too,
// for people beside a big face, crowds and wide shots.
const TINY_FACE = 0.1;
const DEEP_EVERY = 3;
const TILE_SIZE = 512;
// That full search runs at a clip's first sample, at anything that may be a
// cut, and every RESCAN_EVERY samples (for people walking in). In between,
// the faces already seen are followed: the whole frame, plus a tile zoomed
// to each one it misses, FOLLOW_ZOOM times the face's height wide (between
// the two tile sizes above). A face not found is looked for KEEP_LOOKING more
// samples before the next full search has to find it again.
const RESCAN_EVERY = 6;
const FOLLOW_ZOOM = 4;
const KEEP_LOOKING = 2;
// Identity matching: the next sample's face must sit this close (fraction of width).
const MATCH_DISTANCE = 0.1;
const FORGET_AFTER = 4;
// In shared shots the landmarker double-checks each face; one it can't find
// is dropped unless the detector was this sure (fire and patterns fool it).
const SURE_FACE = 0.85;
// Speaker detection: jaw movement compared over this window...
const SPEAKER_WINDOW = 0.9;
// ...must be at least this lively...
const SPEAKING_MIN = 0.03;
// ...and lead the others by this factor, for this long, before the camera switches.
const SPEAKER_LEAD = 1.35;
const SWITCH_HOLD = 0.7;
// Without mouth data, another face must be this much bigger to take over.
const SIZE_LEAD = 1.8;
// The followed person may vanish this long before the camera gives up on them.
const LOST_AFTER = 1.2;

type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Detector = {
  detect: (image: Canvas) => { detections: Detection[] };
};
type Detection = {
  boundingBox?: { originX: number; originY: number; width: number; height: number };
  categories?: { score: number }[];
};
type Landmarker = {
  detect: (image: Canvas) => { faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[] };
};

/** A face in one sample, in 0-1 frame coordinates. */
export interface Face {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

export interface SeenFace extends Face {
  /** Jaw openness, when read. */
  mouth: number | null;
}

interface TrackedFace extends SeenFace {
  id: number;
}

interface Sample {
  time: number;
  cut: boolean;
  faces: TrackedFace[];
}

let visionPromise: Promise<{ detector: Detector; landmarker: Landmarker | null }> | null = null;

/** In a module worker importScripts() throws; in a classic one, called with nothing, it does nothing. */
function isModuleWorker(): boolean {
  try {
    (globalThis as unknown as { importScripts: () => void }).importScripts();
    return false;
  } catch {
    return true;
  }
}

export async function getVision() {
  visionPromise ??= (async () => {
    const { FaceDetector, FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    // A module worker can't load MediaPipe's classic script; it takes the ES
    // module build. (Turbopack starts its workers classic, esbuild's are modules.)
    const inWorker = typeof document === "undefined";
    const files = await FilesetResolver.forVisionTasks(WASM_URL, inWorker && isModuleWorker());
    // MediaPipe drops its loader's global once a model is made from it, and a
    // module worker imports a URL only once: each model there gets its own URL.
    let loads = 0;
    const fileset = () => (inWorker ? { ...files, wasmLoaderPath: `${files.wasmLoaderPath}?load=${++loads}` } : files);
    // Workers run on the CPU: several of them share one GPU, which they'd only
    // queue on, while on the CPU each gets a core (measured: ~3x faster with 4).
    const withDelegate = async <T>(make: (delegate: "GPU" | "CPU") => Promise<T>): Promise<T> => {
      if (inWorker) return make("CPU");
      try {
        return await make("GPU");
      } catch {
        return make("CPU");
      }
    };
    const detector = await withDelegate((delegate) =>
      FaceDetector.createFromOptions(fileset(), {
        baseOptions: { modelAssetPath: DETECTOR_URL, delegate },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.4,
      })
    );
    // Speaker detection is a bonus: without it, the biggest face leads.
    const landmarker = await withDelegate((delegate) =>
      FaceLandmarker.createFromOptions(fileset(), {
        baseOptions: { modelAssetPath: LANDMARKER_URL, delegate },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
      })
    ).catch((error) => {
      console.warn("[clips] speaker detection unavailable:", error);
      return null;
    });
    return {
      detector: detector as unknown as Detector,
      landmarker: landmarker as unknown as Landmarker | null,
    };
  })();
  // A failed load shouldn't stick for the rest of the session.
  visionPromise.catch(() => (visionPromise = null));
  return visionPromise;
}

function makeCanvas(width: number, height: number): Canvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  return Object.assign(document.createElement("canvas"), { width, height });
}

const context = (canvas: Canvas) => canvas.getContext("2d", { willReadFrequently: true }) as Ctx2D;

/** A 16x9 color thumbnail, for spotting cuts. */
function signature(frame: Canvas, scratch: Canvas): number[] {
  const ctx = context(scratch);
  ctx.drawImage(frame, 0, 0, 16, 9);
  const { data } = ctx.getImageData(0, 0, 16, 9);
  const values: number[] = [];
  for (let i = 0; i < data.length; i += 4) values.push(data[i], data[i + 1], data[i + 2]);
  return values;
}

/** The frame shrunk to LUMA_W x LUMA_H, as luminance. */
function grayscale(frame: Canvas, small: Canvas): Uint8Array {
  const ctx = context(small);
  ctx.drawImage(frame, 0, 0, LUMA_W, LUMA_H);
  const { data } = ctx.getImageData(0, 0, LUMA_W, LUMA_H);
  const out = new Uint8Array(LUMA_W * LUMA_H);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    out[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  }
  return out;
}

const difference = (a: number[], b: number[]) =>
  a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function overlap(a: Face, b: Face): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const shared = x * y;
  return shared / (a.w * a.h + b.w * b.h - shared || 1);
}

/** The same face seen twice (by two passes, or a sample apart): overlapping, or centers within half a face. */
function sameFace(a: Face, b: Face, W: number, H: number): boolean {
  return (
    overlap(a, b) >= 0.3 ||
    Math.hypot((a.x + a.w / 2 - b.x - b.w / 2) * W, (a.y + a.h / 2 - b.y - b.h / 2) * H) < 0.5 * Math.max(a.h, b.h) * H
  );
}

/**
 * Faces in a frame. A full search (`follow` null) looks at the whole frame,
 * then zoomed tiles while the faces found are small. Following the faces seen
 * just before, it looks at the whole frame and, zoomed, around each of those
 * it misses there: the same faces for a fraction of the detector calls.
 */
function findFaces(detector: Detector, frame: Canvas, tile: Canvas, deep: boolean, follow: Face[] | null): Face[] {
  const W = frame.width;
  const H = frame.height;
  const ctx = context(tile);
  const read = (detections: Detection[], ox: number, oy: number, scale: number, minScore: number) =>
    detections
      .filter((d) => d.boundingBox && (d.categories?.[0]?.score ?? 0) >= minScore)
      .map((d) => {
        const box = d.boundingBox!;
        return {
          x: (ox + box.originX * scale) / W,
          y: (oy + box.originY * scale) / H,
          w: (box.width * scale) / W,
          h: (box.height * scale) / H,
          score: d.categories?.[0]?.score ?? 0,
        };
      });
  const look = (side: number, x: number, y: number, minScore: number) => {
    ctx.drawImage(frame, x, y, side, side, 0, 0, TILE_SIZE, TILE_SIZE);
    faces.push(...read(detector.detect(tile).detections, x, y, side / TILE_SIZE, minScore));
  };
  const scan = (side: number, xs: number[], ys: number[], minScore: number) => {
    for (const y of ys) for (const x of xs) look(side, x, y, minScore);
  };
  const steps = (span: number, side: number, count: number) =>
    Array.from({ length: count }, (_, i) => (count === 1 ? 0 : (i * (span - side)) / (count - 1)));

  const faces = read(detector.detect(frame).detections, 0, 0, 1, 0.42);
  if (W > H && follow) {
    // Biggest first; a tile already planned covers a face it holds at enough zoom.
    const tiles: { x: number; y: number; side: number }[] = [];
    for (const face of [...follow].sort((a, b) => b.h - a.h)) {
      if (faces.some((found) => sameFace(found, face, W, H))) continue;
      const [fx, fy, fw, fh] = [face.x * W, face.y * H, face.w * W, face.h * H];
      const side = Math.min(H, Math.max(H / 2, fh * FOLLOW_ZOOM));
      const holds = (t: { x: number; y: number; side: number }) =>
        t.side <= side * 1.5 &&
        fx - fw * 0.25 >= t.x &&
        fy - fh * 0.25 >= t.y &&
        fx + fw * 1.25 <= t.x + t.side &&
        fy + fh * 1.25 <= t.y + t.side;
      if (tiles.some(holds)) continue;
      tiles.push({
        side,
        x: Math.min(W - side, Math.max(0, fx + fw / 2 - side / 2)),
        y: Math.min(H - side, Math.max(0, fy + fh / 2 - side / 2)),
      });
    }
    for (const t of tiles) look(t.side, t.x, t.y, t.side > H * 0.75 ? 0.5 : 0.55);
  } else {
    if (W > H) scan(H, steps(W, H, 3), [0], 0.5);
    if (W > H && (deep || faces.every((face) => face.h < TINY_FACE))) {
      scan(H / 2, steps(W, H / 2, 4), steps(H, H / 2, 3), 0.55);
    }
  }
  // The same face seen by two passes (boxes differ a little by scale): keep the surer one.
  faces.sort((a, b) => b.score - a.score);
  const kept: Face[] = [];
  for (const face of faces) if (face.h > 0.025 && !kept.some((k) => sameFace(k, face, W, H))) kept.push(face);
  return kept;
}

/** The landmarker on a crop around `face`: whether it finds a face there, and how open the jaw is (0-1). */
function readMouth(
  landmarker: Landmarker,
  frame: Canvas,
  crop: Canvas,
  face: Face
): { found: boolean; jaw: number | null } {
  const side = Math.max(face.w * frame.width, face.h * frame.height) * 2;
  const cx = (face.x + face.w / 2) * frame.width;
  const cy = (face.y + face.h / 2) * frame.height;
  const ctx = context(crop);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, crop.width, crop.height);
  ctx.drawImage(frame, cx - side / 2, cy - side / 2, side, side, 0, 0, crop.width, crop.height);
  const shapes = landmarker.detect(crop).faceBlendshapes?.[0]?.categories;
  return { found: Boolean(shapes), jaw: shapes?.find((c) => c.categoryName === "jawOpen")?.score ?? null };
}

/** One sample as read from its frame. */
export interface FrameRead {
  /** A 16x9 color thumbnail, for spotting cuts; null when the frame couldn't be decoded. */
  sig: number[] | null;
  luma: Uint8Array | null;
  faces: SeenFace[];
}

export interface FramesRead {
  reads: FrameRead[];
  /** The analysed frames' width / height, when any decoded. */
  aspect: number | null;
  height: number;
}

/** Where a cut lands: the frames between the samples on either side of it, and both samples' thumbnails. */
export interface CutPin {
  between: number[];
  before: number[];
  after: number[];
}

const aborted = () => new DOMException("Aborted", "AbortError");

async function openVideo(blob: Blob) {
  const { ALL_FORMATS, BlobSource, CanvasSink, Input } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack().catch((error) => {
    input.dispose();
    throw error;
  });
  return {
    input,
    track,
    sink: track ? new CanvasSink(track, { width: ANALYSIS_WIDTH, poolSize: 2 }) : null,
  };
}

/**
 * Reads the frames at `stamps` (the video's own time): each one's thumbnail,
 * grayscale copy and faces, with who is talking where people share a shot.
 * `firstIndex` is the first stamp's place in the whole clip. Runs in this
 * thread or in a face tracking worker; null when the video has no picture.
 */
export async function readFrames(
  blob: Blob,
  stamps: number[],
  firstIndex: number,
  onFrame?: () => void,
  signal?: AbortSignal
): Promise<FramesRead | null> {
  const [{ input, track, sink }, vision] = await Promise.all([openVideo(blob), getVision()]);
  try {
    if (!track || !sink) return null;
    const scratch = makeCanvas(16, 9);
    const small = makeCanvas(LUMA_W, LUMA_H);
    const tile = makeCanvas(TILE_SIZE, TILE_SIZE);
    const crop = makeCanvas(256, 256);
    const reads: FrameRead[] = [];
    let aspect: number | null = null;
    // The faces being followed, and for how many samples each has gone unseen.
    let following: { face: Face; missed: number }[] = [];
    let previous: number[] | null = null;
    let sinceSearch = Infinity;
    for await (const wrapped of sink.canvasesAtTimestamps(stamps)) {
      if (signal?.aborted) throw aborted();
      const index = firstIndex + reads.length;
      onFrame?.();
      if (!wrapped) {
        reads.push({ sig: null, luma: null, faces: [] });
        continue;
      }
      const frame = wrapped.canvas;
      aspect = frame.width / frame.height;
      const sig = signature(frame, scratch);
      const luma = grayscale(frame, small);
      // Maybe a cut (findCuts decides later, from more than this): search the new shot afresh.
      const newShot = !previous || difference(previous, sig) > SHOT_CHANGE;
      previous = sig;
      if (newShot) following = [];
      const search = newShot || ++sinceSearch >= RESCAN_EVERY;
      if (search) sinceSearch = 0;

      let faces: SeenFace[] = findFaces(
        vision.detector,
        frame,
        tile,
        index % DEEP_EVERY === 0 || search,
        search ? null : following.map(({ face }) => face)
      )
        .sort((a, b) => b.w * b.h - a.w * a.h)
        .map((face) => ({ ...face, mouth: null }));
      // Only shared shots need to know who is talking; the same read weeds out false faces.
      if (vision.landmarker && faces.length > 1) {
        // The four biggest are checked; past those, only sure detections stay.
        const checked = faces.slice(0, 4).map((face) => {
          const read = readMouth(vision.landmarker!, frame, crop, face);
          return read.found || face.score >= SURE_FACE ? { ...face, mouth: read.jaw } : null;
        });
        faces = [
          ...checked.filter((face): face is SeenFace => face !== null),
          ...faces.slice(4).filter((face) => face.score >= SURE_FACE),
        ];
      }
      reads.push({ sig, luma, faces });
      const W = frame.width;
      const H = frame.height;
      following = [
        ...faces.map((face) => ({ face: face as Face, missed: 0 })),
        ...following
          .filter(({ face, missed }) => missed < KEEP_LOOKING && !faces.some((f) => sameFace(f, face, W, H)))
          .map(({ face, missed }) => ({ face, missed: missed + 1 })),
      ];
    }
    return { reads, aspect, height: track.displayHeight };
  } finally {
    input.dispose();
  }
}

/** Each cut's frame: the first one between its two samples that looks like the new shot (video time), or null. */
export async function pinCuts(blob: Blob, pins: CutPin[], signal?: AbortSignal): Promise<(number | null)[]> {
  const { input, sink } = await openVideo(blob);
  try {
    const scratch = makeCanvas(16, 9);
    const out: (number | null)[] = [];
    for (const { between, before, after } of pins) {
      if (signal?.aborted) throw aborted();
      let found: number | null = null;
      let k = 0;
      if (sink) {
        for await (const wrapped of sink.canvasesAtTimestamps(between)) {
          const t = between[k++];
          if (!wrapped) continue;
          const sig = signature(wrapped.canvas, scratch);
          if (difference(sig, after) < difference(sig, before)) {
            found = t;
            break;
          }
        }
      }
      out.push(found);
    }
    return out;
  } finally {
    input.dispose();
  }
}

// ---- Face tracking workers ----
//
// Each worker loads its own detector and decodes its own part of the clip, so
// a clip is read by several at once (a detector call mostly waits on the GPU,
// so they overlap well), and the editor's thread stays free for the preview.
// The pool lives on between clips, so the models load once per editor visit.

export type ReframeWorkerRequest =
  | { id: 0; kind: "warm" }
  | { id: number; kind: "read"; blob: Blob; stamps: number[]; firstIndex: number }
  | { id: number; kind: "pin"; blob: Blob; pins: CutPin[] };

export type ReframeWorkerReply =
  | { id: 0; kind: "ready" }
  | { id: number; kind: "frame" }
  | { id: number; kind: "done"; result: FramesRead | null | (number | null)[] }
  | { id: number; kind: "error"; message: string };

/** Makes one face tracking worker (the bundler resolves its script, so the app supplies this). */
export type ReframeWorkerFactory = () => Worker;

// Samples per piece of work: small enough that the workers finish together,
// big enough that each piece's seek to its first frame stays a small cost.
const CHUNK_MIN = 24;
// Workers end this long after the last clip, freeing their memory.
const POOL_IDLE_MS = 90_000;

// A worker that hasn't loaded by then counts as failed (tracking moves to the page).
const READY_TIMEOUT_MS = 20_000;

let pool: Worker[] = [];
let poolReady: Promise<Worker[]> | null = null;
// Clips (and warm-ups) using the pool: it ends only when none are.
let poolUsers = 0;
let poolTimer: ReturnType<typeof setTimeout> | null = null;
let poolBroken = false;
let nextJob = 1;
// Requests in flight, failed at once if the pool ends under them.
const inFlight = new Set<(error: Error) => void>();

function poolSize(): number {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  return Math.max(1, Math.min(4, Math.floor(cores / 2), memory <= 4 ? 2 : 4));
}

function endPool() {
  for (const worker of pool) worker.terminate();
  pool = [];
  poolReady = null;
  if (poolTimer) clearTimeout(poolTimer);
  poolTimer = null;
  for (const fail of [...inFlight]) fail(new Error("Face tracking workers stopped"));
}

/** Waits for a worker's "ready": its script loaded (a bundler may load it in pieces) and it's listening. */
function whenReady(worker: Worker): Promise<Worker> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("A face tracking worker didn't start")), READY_TIMEOUT_MS);
    const finish = (error?: Error) => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      if (error) reject(error);
      else resolve(worker);
    };
    worker.onmessage = ({ data }: MessageEvent<ReframeWorkerReply>) => {
      if (data.kind === "ready") finish();
    };
    worker.onerror = (event) => finish(new Error(event.message || "A face tracking worker failed to load"));
  });
}

/** The pool, started if need be. Every take is paired with a releasePool(). */
function takePool(make: ReframeWorkerFactory): Promise<Worker[]> {
  poolUsers++;
  if (poolTimer) clearTimeout(poolTimer);
  poolTimer = null;
  if (!poolReady) {
    pool = Array.from({ length: poolSize() }, make);
    poolReady = Promise.all(pool.map(whenReady));
  }
  return poolReady;
}

function releasePool() {
  poolUsers = Math.max(0, poolUsers - 1);
  if (poolUsers > 0) return;
  if (poolTimer) clearTimeout(poolTimer);
  poolTimer = setTimeout(endPool, POOL_IDLE_MS);
}

/**
 * Starts the workers and loads their models ahead of the first clip (its cut
 * usually takes longer than this), so tracking starts at full speed.
 */
export function warmReframeWorkers(make: ReframeWorkerFactory) {
  if (poolBroken || typeof Worker === "undefined") return;
  takePool(make)
    .then((workers) => {
      for (const worker of workers) worker.postMessage({ id: 0, kind: "warm" } satisfies ReframeWorkerRequest);
    })
    .catch((error) => {
      // A worker script that won't load won't load for a clip either.
      console.warn("[clips] face tracking workers unavailable; tracking on the page:", error);
      poolBroken = true;
      endPool();
    })
    .finally(releasePool);
}

/** One request on one worker, which runs one at a time. */
function ask<T>(
  worker: Worker,
  request: ReframeWorkerRequest,
  onFrame: (() => void) | undefined,
  signal: AbortSignal | undefined
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const fail = (error: Error) => {
      done();
      reject(error);
    };
    const stop = () => fail(aborted());
    const done = () => {
      inFlight.delete(fail);
      signal?.removeEventListener("abort", stop);
      worker.onmessage = null;
      worker.onerror = null;
    };
    if (signal?.aborted) return stop();
    signal?.addEventListener("abort", stop, { once: true });
    inFlight.add(fail);
    worker.onmessage = ({ data }: MessageEvent<ReframeWorkerReply>) => {
      if (data.id !== request.id) return;
      if (data.kind === "frame") return onFrame?.();
      if (data.kind === "done") {
        done();
        resolve(data.result as T);
      } else if (data.kind === "error") fail(new Error(data.message));
    };
    worker.onerror = (event) => fail(new Error(event.message || "A face tracking worker failed"));
    worker.postMessage(request);
  });
}

/** Hands `tasks` to the workers, each taking the next as it finishes one. */
async function shareOut<T>(
  workers: Worker[],
  tasks: ((worker: Worker) => Promise<T>)[]
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    workers.map(async (worker) => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i](worker);
      }
    })
  );
  return results;
}

/** The whole clip's frames, read by the workers in pieces. */
async function readFramesInWorkers(
  workers: Worker[],
  blob: Blob,
  stamps: number[],
  onFrame: () => void,
  signal?: AbortSignal
): Promise<FramesRead | null> {
  const size = Math.max(CHUNK_MIN, Math.ceil(stamps.length / (workers.length * 2)));
  const tasks: ((worker: Worker) => Promise<FramesRead | null>)[] = [];
  for (let from = 0; from < stamps.length; from += size) {
    const chunk = stamps.slice(from, from + size);
    tasks.push((worker) =>
      ask<FramesRead | null>(
        worker,
        { id: nextJob++, kind: "read", blob, stamps: chunk, firstIndex: from },
        onFrame,
        signal
      )
    );
  }
  const parts = await shareOut(workers, tasks);
  if (parts.some((part) => !part)) return null;
  return {
    reads: parts.flatMap((part) => part!.reads),
    aspect: parts.find((part) => part!.aspect !== null)?.aspect ?? null,
    height: parts[0]!.height,
  };
}

async function pinCutsInWorkers(
  workers: Worker[],
  blob: Blob,
  pins: CutPin[],
  signal?: AbortSignal
): Promise<(number | null)[]> {
  const per = Math.ceil(pins.length / workers.length);
  const groups: CutPin[][] = [];
  for (let i = 0; i < pins.length; i += per) groups.push(pins.slice(i, i + per));
  const parts = await shareOut(
    workers,
    groups.map((group) => (worker: Worker) =>
      ask<(number | null)[]>(worker, { id: nextJob++, kind: "pin", blob, pins: group }, undefined, signal)
    )
  );
  return parts.flat();
}

/**
 * Samples the clip's frames, finds and identifies the faces in each, reads
 * who is talking, and returns the subject to follow. Reports 0..1 progress.
 * With `makeWorker`, the frames are read by a pool of workers in parallel
 * (falling back to this thread if they can't run).
 */
export async function analyzeReframe(
  source: ClipSource,
  start: number,
  end: number,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
  makeWorker?: ReframeWorkerFactory
): Promise<ReframeTrack> {
  const localStart = Math.max(0, start - source.offset);
  const localEnd = Math.max(localStart, end - source.offset);
  const stamps: number[] = [];
  for (let t = localStart; t <= localEnd + 1e-6; t += SAMPLE_EVERY) stamps.push(t);

  let done = 0;
  const onFrame = () => onProgress?.(Math.min(1, ++done / stamps.length));
  let workers: Worker[] | null = null;
  let read: FramesRead | null = null;
  if (makeWorker && !poolBroken && typeof Worker !== "undefined") {
    const ready = takePool(makeWorker);
    try {
      workers = await ready;
      read = await readFramesInWorkers(workers, source.blob, stamps, onFrame, signal);
    } catch (error) {
      workers = null;
      releasePool();
      endPool();
      if (signal?.aborted) throw aborted();
      // Workers that can't run here (an old browser, no OffscreenCanvas): this thread, from now on.
      console.warn("[clips] face tracking workers failed; tracking on the page:", error);
      poolBroken = true;
      done = 0;
    }
  }
  if (!workers) read = await readFrames(source.blob, stamps, 0, onFrame, signal);

  try {
    if (!read) {
      return {
        aspect: 16 / 9,
        times: [],
        subject: [],
        breaks: [],
        faces: 0,
        switches: 0,
        frames: [],
        cuts: [],
        motion: [],
        luma: [],
      };
    }
    const aspect = read.aspect ?? 16 / 9;
    let previous: number[] | null = null;
    const seen = read.reads.map(({ sig, faces }, i) => {
      const time = stamps[i] + source.offset;
      if (!sig) return { time, change: 0, faces };
      const change = previous ? difference(previous, sig) : 0;
      previous = sig;
      return { time, change, faces };
    });
    const cuts = findCuts(seen);

    // Pin each cut to its frame: the first frame between the two samples that
    // looks like the new shot. Layouts and the camera switch there.
    const pinned: number[] = [];
    const pins: CutPin[] = [];
    for (let i = 1; i < seen.length; i++) {
      const before = read.reads[i - 1].sig;
      const after = read.reads[i].sig;
      if (!cuts[i] || !before || !after) continue;
      const between: number[] = [];
      for (let t = stamps[i - 1] + 1 / 30; t < stamps[i] - 1e-3; t += 1 / 30) between.push(t);
      pinned.push(i);
      pins.push({ between, before, after });
    }
    if (pins.length) {
      const times = workers
        ? await pinCutsInWorkers(workers, source.blob, pins, signal).catch((error) => {
            if (signal?.aborted) throw aborted();
            console.warn("[clips] pinning cuts in the workers failed; pinning on the page:", error);
            return pinCuts(source.blob, pins, signal);
          })
        : await pinCuts(source.blob, pins, signal);
      times.forEach((t, k) => {
        if (t !== null) seen[pinned[k]].time = t + source.offset;
      });
    }

    const samples = linkIdentities(seen, cuts, aspect);
    return {
      ...chooseSubject(samples, aspect),
      height: read.height,
      frames: samples.map((sample) =>
        sample.faces.map((f) => ({ id: f.id, x: f.x + f.w / 2, y: f.y + f.h / 2, w: f.w, h: f.h, score: f.score }))
      ),
      cuts,
      motion: seen.map((sample) => sample.change),
      luma: read.reads.map((r) => r.luma),
    };
  } finally {
    if (workers) releasePool();
  }
}

/** Shot changes: spikes in frame difference against the change around them, not sustained motion. */
function findCuts(seen: { time: number; change: number }[]): boolean[] {
  let lastCut = -Infinity;
  return seen.map((sample, i) => {
    const window = [...seen.slice(Math.max(0, i - 3), i), ...seen.slice(i + 1, i + 4)].map((s) => s.change);
    const around = window.length ? median(window) : 0;
    const cut =
      i > 0 &&
      sample.change > SHOT_CHANGE &&
      (sample.change > HARD_CUT || sample.change > around * SPIKE) &&
      sample.time - lastCut >= MIN_SHOT;
    if (cut) lastCut = sample.time;
    return cut;
  });
}

/** Links each sample's faces to people, biggest faces first; a cut starts over. */
function linkIdentities(seen: { time: number; faces: SeenFace[] }[], cuts: boolean[], aspect: number): Sample[] {
  let people: { id: number; x: number; y: number; h: number; seen: number }[] = [];
  let nextId = 1;
  return seen.map(({ time, faces }, i) => {
    if (cuts[i]) people = [];
    people = people.filter((p) => time - p.seen < FORGET_AFTER);
    const taken = new Set<number>();
    const tracked = faces.map((face): TrackedFace => {
      const cx = face.x + face.w / 2;
      const cy = face.y + face.h / 2;
      let best: (typeof people)[number] | null = null;
      let bestDistance = MATCH_DISTANCE + face.w / 2;
      for (const person of people) {
        // The same person: close by and about the same size.
        if (taken.has(person.id) || face.h < person.h * 0.6 || face.h > person.h * 1.7) continue;
        const distance = Math.hypot(person.x - cx, (person.y - cy) / aspect);
        if (distance < bestDistance) {
          best = person;
          bestDistance = distance;
        }
      }
      const person = best ?? { id: nextId++, x: cx, y: cy, h: face.h, seen: time };
      if (!best) people.push(person);
      Object.assign(person, { x: cx, y: cy, h: face.h, seen: time });
      taken.add(person.id);
      return { ...face, id: person.id };
    });
    return { time, cut: cuts[i], faces: tracked };
  });
}

/** Per sample, the person to follow: the one talking in shared shots, else the dominant face. */
function chooseSubject(samples: Sample[], aspect: number): Omit<ReframeTrack, "frames" | "cuts" | "motion" | "luma"> {
  // How much each person's jaw moves around each sample: talking, not just an open mouth.
  const liveliness = samples.map((sample, i) => {
    const scores = new Map<number, number>();
    for (const face of sample.faces) {
      if (face.mouth === null) continue;
      // Within this shot only: stop at the shot's first sample, and before the next shot.
      const values: number[] = [];
      for (let j = i; j >= 0 && sample.time - samples[j].time <= SPEAKER_WINDOW / 2; j--) {
        const v = samples[j].faces.find((f) => f.id === face.id)?.mouth;
        if (v != null) values.push(v);
        if (samples[j].cut) break;
      }
      for (
        let j = i + 1;
        j < samples.length && samples[j].time - sample.time <= SPEAKER_WINDOW / 2 && !samples[j].cut;
        j++
      ) {
        const v = samples[j].faces.find((f) => f.id === face.id)?.mouth;
        if (v != null) values.push(v);
      }
      if (values.length < 3) continue;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      scores.set(face.id, Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length));
    }
    return scores;
  });

  // Who leads in each sample, if anyone clearly does.
  const leaders = samples.map((sample, i) => {
    if (!sample.faces.length) return null;
    if (sample.faces.length === 1) return sample.faces[0].id;
    const ranked = [...liveliness[i].entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length && ranked[0][1] >= SPEAKING_MIN && ranked[0][1] >= (ranked[1]?.[1] ?? 0) * SPEAKER_LEAD) {
      return ranked[0][0];
    }
    // No clear speaker: a much bigger face still leads.
    const [first, second] = [...sample.faces].sort((a, b) => b.w * b.h - a.w * a.h);
    return first.w * first.h >= second.w * second.h * SIZE_LEAD ? first.id : null;
  });

  const ids: (number | null)[] = samples.map(() => null);
  const breaks = samples.map((s) => s.cut);
  let current: number | null = null;
  let lastSeen = -Infinity;
  let challenger: number | null = null;
  let challengeFrom = 0;
  let switches = 0;
  samples.forEach((sample, i) => {
    if (sample.cut || i === 0) {
      current = leaders[i] ?? sample.faces[0]?.id ?? null;
      challenger = null;
      lastSeen = sample.time;
    }
    const present = sample.faces.some((f) => f.id === current);
    if (present) lastSeen = sample.time;

    const leader = leaders[i];
    if (current === null && leader !== null) {
      // Nobody followed yet in this shot: take the first clear lead at once.
      current = leader;
      lastSeen = sample.time;
    } else if (leader !== null && leader !== current) {
      if (challenger !== leader) {
        challenger = leader;
        challengeFrom = i;
      }
      const lostThem = !present && sample.time - lastSeen > LOST_AFTER;
      if (lostThem || sample.time - samples[challengeFrom].time >= SWITCH_HOLD) {
        // Switch where the new speaker's lead began, so the cut lands as they start.
        current = leader;
        for (let j = challengeFrom; j < i; j++) ids[j] = current;
        if (!breaks[challengeFrom]) {
          breaks[challengeFrom] = true;
          switches++;
        }
        challenger = null;
        lastSeen = sample.time;
      }
    } else if (leader === current) {
      challenger = null;
    }
    ids[i] = current;
  });

  return {
    aspect,
    times: samples.map((s) => s.time),
    subject: samples.map((sample, i) => {
      const face = sample.faces.find((f) => f.id === ids[i]);
      return face ? face.x + face.w / 2 : null;
    }),
    breaks,
    faces: Math.max(0, ...samples.map((s) => s.faces.length)),
    switches,
  };
}

/** Linear fill between known values; ends hold the nearest one. */
export function fillGaps(values: (number | null)[], fallback: number): number[] {
  const known = values
    .map((v, i) => [i, v] as const)
    .filter((pair): pair is readonly [number, number] => pair[1] !== null);
  if (!known.length) return values.map(() => fallback);
  return values.map((v, i) => {
    if (v !== null) return v;
    const after = known.find(([k]) => k > i);
    const before = [...known].reverse().find(([k]) => k < i);
    if (!before) return after![1];
    if (!after) return before[1];
    return before[1] + ((after[1] - before[1]) * (i - before[0])) / (after[0] - before[0]);
  });
}

export function medianFilter(values: number[], radius: number): number[] {
  return values.map((_, i) => median(values.slice(Math.max(0, i - radius), i + radius + 1)));
}

export function gaussian(values: number[], sigma: number): number[] {
  const radius = Math.ceil(sigma * 3);
  const weights = Array.from({ length: radius * 2 + 1 }, (_, k) =>
    Math.exp(-((k - radius) ** 2) / (2 * sigma * sigma))
  );
  return values.map((_, i) => {
    let sum = 0;
    let total = 0;
    weights.forEach((w, k) => {
      const j = Math.min(values.length - 1, Math.max(0, i + k - radius));
      sum += values[j] * w;
      total += w;
    });
    return sum / total;
  });
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

/** A camera operator: still while the subject stays near the middle, short eased pans when they leave. */
export function operate(times: number[], xs: number[], crop: number, end: number) {
  const deadZone = crop * 0.14;
  const out = { times: [times[0]], centers: [median(xs.slice(0, 4))] };
  let x = out.centers[0];
  let free = times[0];
  for (let i = 0; i < xs.length; i++) {
    if (times[i] < free || Math.abs(xs[i] - x) <= deadZone) continue;
    // Only move for a subject that stays out, not a passing lean.
    if (!xs.slice(i, i + 3).every((v) => Math.abs(v - x) > deadZone * 0.7)) continue;
    const target = median(xs.slice(i, i + 5));
    const duration = Math.min(0.9, Math.max(0.35, (Math.abs(target - x) / crop) * 1.1));
    const from = Math.max(free, times[i] - 0.12);
    const steps = Math.ceil(duration * 30);
    out.times.push(from);
    out.centers.push(x);
    for (let k = 1; k <= steps; k++) {
      const t = from + (k / steps) * duration;
      if (t > end) break;
      out.times.push(t);
      out.centers.push(x + (target - x) * easeInOut(k / steps));
    }
    x = target;
    free = from + duration;
  }
  if (end > out.times[out.times.length - 1]) {
    out.times.push(end);
    out.centers.push(x);
  }
  return out;
}

/**
 * The camera path for an output whose crop has aspect `outputAspect` (w/h).
 * Empty when the crop is the whole frame.
 */
export function cameraPath(track: ReframeTrack, outputAspect: number, mode: CameraMode): CameraPath {
  const crop = Math.min(1, outputAspect / track.aspect);
  const path: CameraPath = { times: [], centers: [] };
  if (!track.times.length || crop >= 0.999) return path;
  const lo = crop / 2;
  const hi = 1 - crop / 2;

  const starts = [0, ...track.breaks.flatMap((b, i) => (b && i > 0 ? [i] : []))];
  let last = 0.5;
  starts.forEach((from, s) => {
    const to = starts[s + 1] ?? track.times.length;
    const times = track.times.slice(from, to);
    const raw = fillGaps(track.subject.slice(from, to), last).map((v) => Math.min(hi, Math.max(lo, v)));
    const smooth = gaussian(medianFilter(raw, 2), mode === "follow" ? 2 : 1.5);
    const end = track.times[to] !== undefined ? track.times[to] - 0.002 : times[times.length - 1];
    const segment = mode === "follow" ? { times, centers: smooth } : operate(times, smooth, crop, end);
    // A cut is a hard jump: two keys at (almost) the same time.
    if (path.times.length) {
      path.times.push(times[0] - 0.001);
      path.centers.push(path.centers[path.centers.length - 1]);
    }
    path.times.push(...segment.times);
    path.centers.push(...segment.centers);
    last = segment.centers[segment.centers.length - 1];
  });
  return path;
}

/** The camera's center at `time`, interpolated between keys. */
export function centerAt(path: CameraPath | null | undefined, time: number): number | null {
  if (!path || !path.times.length) return null;
  const { times, centers } = path;
  if (time <= times[0]) return centers[0];
  if (time >= times[times.length - 1]) return centers[centers.length - 1];
  let lo = 0;
  let hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= time) lo = mid;
    else hi = mid;
  }
  const span = times[hi] - times[lo] || 1;
  return centers[lo] + ((centers[hi] - centers[lo]) * (time - times[lo])) / span;
}
