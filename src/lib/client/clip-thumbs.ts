// A still of each detected moment, for the Choose list. Read from the clip's
// stored cut (see GET /api/clips/[id]/sources) with range requests, so only
// the fragment holding the frame is fetched and one frame is decoded
// (WebCodecs via Mediabunny). Cached for the session per clip.

const WIDTH = 320;
const HEIGHT = 180;
// Into the moment, past a cut that may open it.
const INTO_CLIP = 1.2;
const PARALLEL = 2;

const cache = new Map<string, Promise<string | null>>();
const queue: (() => void)[] = [];
let running = 0;

function next() {
  if (running >= PARALLEL) return;
  const job = queue.shift();
  if (!job) return;
  running++;
  job();
}

function limited<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() =>
      task()
        .then(resolve, reject)
        .finally(() => {
          running--;
          next();
        })
    );
    next();
  });
}

/**
 * An object URL of a JPEG still at `time` (seconds into the cut), or null
 * when the cut can't be read or decoded here. `key` names the clip.
 */
export function clipThumb(key: string, url: string, time: number): Promise<string | null> {
  let job = cache.get(key);
  if (!job) {
    job = limited(() => readFrame(url, time)).catch(() => null);
    cache.set(key, job);
    // A failure may be a lapsed URL or a dropped connection: let a later look try again.
    job.then((thumb) => {
      if (!thumb) cache.delete(key);
    });
  }
  return job;
}

/** Seconds into a stored cut where a moment's still is taken. */
export function thumbTime(start: number, end: number, offset: number): number {
  return Math.max(0, start + Math.min(INTO_CLIP, (end - start) / 4) - offset);
}

async function readFrame(url: string, time: number): Promise<string | null> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.UrlSource(url), formats: mb.ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return null;
    const sink = new mb.CanvasSink(track, { width: WIDTH, height: HEIGHT, fit: "cover" });
    const first = await track.getFirstTimestamp();
    const frame = await sink.getCanvas(first + time);
    if (!frame) return null;
    const blob = await toJpeg(frame.canvas);
    return blob ? URL.createObjectURL(blob) : null;
  } finally {
    input.dispose();
  }
}

function toJpeg(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob | null> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
}
