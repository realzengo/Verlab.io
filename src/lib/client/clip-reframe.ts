// AI reframe: follows the main face across a clip so a 16:9 source can be
// cropped to 9:16 (or 1:1) without losing the speaker -- OpusClip's headline
// feature, done in the browser. MediaPipe's BlazeFace runs on sampled frames,
// the busiest face is followed with some stickiness, shot changes snap the
// virtual camera, and everything else glides.

import type { ClipSource } from "@/lib/client/clip-render";

/** Horizontal center of the subject (0 = left edge, 1 = right edge) over source time. */
export interface ReframeTrack {
  times: number[];
  centers: number[];
}

const MEDIAPIPE_VERSION = "1.2.2";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

const SAMPLE_EVERY = 0.2;
const ANALYSIS_WIDTH = 640;
// Mean luminance change (0-255) between samples that counts as a cut.
const SHOT_CHANGE = 28;
// A face this much bigger than the one being followed takes over.
const SWITCH_RATIO = 1.8;
// The camera ignores moves smaller than this (fraction of frame width).
const DEAD_ZONE = 0.035;
const EASE = 0.35;

type Detector = {
  detect: (image: HTMLCanvasElement | OffscreenCanvas) => { detections: Detection[] };
  close: () => void;
};
type Detection = { boundingBox?: { originX: number; width: number; height: number }; categories?: { score: number }[] };

let detectorPromise: Promise<Detector> | null = null;

async function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const make = (delegate: "GPU" | "CPU") =>
      FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.45,
      });
    try {
      return (await make("GPU")) as unknown as Detector;
    } catch {
      return (await make("CPU")) as unknown as Detector;
    }
  })();
  // A failed load shouldn't stick for the rest of the session.
  detectorPromise.catch(() => (detectorPromise = null));
  return detectorPromise;
}

/** Average luminance of a 16x9 thumbnail, for spotting cuts. */
function signature(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  scratch: OffscreenCanvas | HTMLCanvasElement
): number[] {
  const ctx = scratch.getContext("2d", { willReadFrequently: true }) as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.drawImage(canvas, 0, 0, 16, 9);
  const { data } = ctx.getImageData(0, 0, 16, 9);
  const values: number[] = [];
  for (let i = 0; i < data.length; i += 4) values.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  return values;
}

const difference = (a: number[], b: number[]) =>
  a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Samples the clip's frames, finds the face to follow in each, and returns
 * a smoothed camera path. Faceless stretches hold the last position (or the
 * center). Reports 0..1 progress.
 */
export async function analyzeReframe(
  source: ClipSource,
  start: number,
  end: number,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<ReframeTrack> {
  const [{ ALL_FORMATS, BlobSource, CanvasSink, Input }, detector] = await Promise.all([
    import("mediabunny"),
    getDetector(),
  ]);
  const input = new Input({ source: new BlobSource(source.blob), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return { times: [], centers: [] };
    const sink = new CanvasSink(track, { width: ANALYSIS_WIDTH, poolSize: 2 });
    const scratch =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(16, 9)
        : Object.assign(document.createElement("canvas"), { width: 16, height: 9 });

    const localStart = Math.max(0, start - source.offset);
    const localEnd = Math.max(localStart, end - source.offset);
    const stamps: number[] = [];
    for (let t = localStart; t <= localEnd + 1e-6; t += SAMPLE_EVERY) stamps.push(t);

    const raw: { time: number; center: number | null; cut: boolean }[] = [];
    let previous: number[] | null = null;
    let followed: number | null = null;
    let index = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(stamps)) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const time = stamps[index++] + source.offset;
      if (!wrapped) {
        raw.push({ time, center: null, cut: false });
        continue;
      }
      const { canvas } = wrapped;
      const sig = signature(canvas, scratch);
      const cut = previous ? difference(previous, sig) > SHOT_CHANGE : false;
      previous = sig;
      if (cut) followed = null;

      const faces = detector
        .detect(canvas)
        .detections.filter((d) => d.boundingBox)
        .map((d) => ({
          center: (d.boundingBox!.originX + d.boundingBox!.width / 2) / canvas.width,
          area: d.boundingBox!.width * d.boundingBox!.height,
        }));
      let center: number | null = null;
      if (faces.length) {
        const biggest = faces.reduce((a, b) => (b.area > a.area ? b : a));
        // Stay on the face already being followed unless another clearly dominates.
        const target: number | null = followed;
        const nearest: { center: number; area: number } | null =
          target === null
            ? null
            : faces.reduce((a, b) => (Math.abs(b.center - target) < Math.abs(a.center - target) ? b : a));
        center =
          nearest &&
          target !== null &&
          Math.abs(nearest.center - target) < 0.15 &&
          biggest.area < nearest.area * SWITCH_RATIO
            ? nearest.center
            : biggest.center;
        followed = center;
      }
      raw.push({ time, center, cut });
      onProgress?.(index / stamps.length);
    }

    // Fill faceless samples from neighbours within the same shot, then
    // median-filter the jitter and ease the camera inside each shot.
    let last = raw.find((r) => r.center !== null)?.center ?? 0.5;
    const filled = raw.map((r) => {
      if (r.cut && r.center === null) last = 0.5;
      if (r.center !== null) last = r.center;
      return { ...r, center: last };
    });
    const times: number[] = [];
    const centers: number[] = [];
    let camera = filled[0]?.center ?? 0.5;
    filled.forEach((sample, i) => {
      let j = i;
      while (j > 0 && !filled[j].cut && i - j < 2) j--;
      let k = i;
      while (k < filled.length - 1 && !filled[k + 1].cut && k - i < 2) k++;
      const target = median(filled.slice(j, k + 1).map((s) => s.center));
      if (sample.cut || i === 0) camera = target;
      else if (Math.abs(target - camera) > DEAD_ZONE) camera += (target - camera) * EASE;
      // A cut is a hard jump: two keys at (almost) the same time.
      if (sample.cut && times.length) {
        times.push(sample.time - 0.001);
        centers.push(centers[centers.length - 1]);
      }
      times.push(sample.time);
      centers.push(camera);
    });
    return { times, centers };
  } finally {
    input.dispose();
  }
}

/** The camera's center at `time`, interpolated between samples. */
export function centerAt(track: ReframeTrack | null | undefined, time: number): number | null {
  if (!track || !track.times.length) return null;
  const { times, centers } = track;
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
