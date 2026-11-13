// Cuts one time range out of a fragmented MP4 *stream* without decoding it.
//
// The video-download provider (savenow) serves YouTube sources as a live,
// fragmented MP4 (ftyp, moov, then moof+mdat pairs) with no Range support,
// so the only way to reach minute 40 is to read past minutes 0-39. This
// walks the stream box by box, keeps ftyp+moov, drops every fragment before
// the range, and passes through only the fragments that cover it -- starting
// at the last video keyframe before `start` -- then stops reading. The kept
// fragments are shifted to start at 0 (browsers disagree on how to present
// an MP4 whose first timestamp is 40 minutes in), and the shift is reported
// so the caller can map source times onto the cut. The browser trims to the
// exact range while it renders. Several ranges share one read, since
// reaching any point means reading everything before it.

export class Fmp4CutError extends Error {
  constructor(
    message: string,
    /** "no_audio": the source has no audio track, so every cut would be silent. */
    readonly code?: "no_audio"
  ) {
    super(message);
    this.name = "Fmp4CutError";
  }
}

type TrackKind = "video" | "audio" | "other";

interface TrackInfo {
  timescale: number;
  kind: TrackKind;
  defaultSampleFlags: number | null;
}

interface Fragment {
  /** Earliest decode time across the fragment's tracks, seconds. */
  start: number;
  /** The video track's own decode time, when the fragment carries video. */
  videoStart: number | null;
  isVideo: boolean;
  startsWithSync: boolean;
  trackIds: number[];
  /** Where the moof sat in the source; tfhd base offsets are relative to the file. */
  sourceOffset: number;
  bytes: Uint8Array[];
}

interface Box {
  type: string;
  start: number;
  size: number;
  headerSize: number;
}

// Audio fragments that begin shortly before the chosen keyframe still carry
// samples the clip needs, so they're kept.
const AUDIO_LEAD_SECONDS = 3;
// Interleaving between tracks is never this far apart; past it, stop even if
// one track never reported its end.
const END_SAFETY_SECONDS = 10;
// A single box this large means a regular (non-fragmented) MP4's mdat, which
// can't be cut while streaming.
const MAX_BOX_BYTES = 64 * 1024 * 1024;

function readType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function childBoxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxes: Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset);
    let headerSize = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) break;
    boxes.push({ type: readType(bytes, offset + 4), start: offset, size, headerSize });
    offset += size;
  }
  return boxes;
}

function child(bytes: Uint8Array, parent: Box, type: string): Box | undefined {
  return childBoxes(bytes, parent.start + parent.headerSize, parent.start + parent.size).find(
    (box) => box.type === type
  );
}

function children(bytes: Uint8Array, parent: Box, type: string): Box[] {
  return childBoxes(bytes, parent.start + parent.headerSize, parent.start + parent.size).filter(
    (box) => box.type === type
  );
}

function wholeBox(bytes: Uint8Array): Box {
  return { type: readType(bytes, 4), start: 0, size: bytes.byteLength, headerSize: 8 };
}

function parseMoov(moov: Uint8Array): Map<number, TrackInfo> {
  const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
  const root = wholeBox(moov);
  const tracks = new Map<number, TrackInfo>();

  for (const trak of children(moov, root, "trak")) {
    const tkhd = child(moov, trak, "tkhd");
    const mdia = child(moov, trak, "mdia");
    const mdhd = mdia && child(moov, mdia, "mdhd");
    const hdlr = mdia && child(moov, mdia, "hdlr");
    if (!tkhd || !mdhd || !hdlr) continue;

    const tkhdBody = tkhd.start + tkhd.headerSize;
    const trackId = view.getUint32(tkhdBody + (moov[tkhdBody] === 1 ? 20 : 12));
    const mdhdBody = mdhd.start + mdhd.headerSize;
    const timescale = view.getUint32(mdhdBody + (moov[mdhdBody] === 1 ? 20 : 12));
    const handler = readType(moov, hdlr.start + hdlr.headerSize + 8);
    const kind: TrackKind = handler === "vide" ? "video" : handler === "soun" ? "audio" : "other";
    if (timescale > 0) tracks.set(trackId, { timescale, kind, defaultSampleFlags: null });
  }

  const mvex = child(moov, root, "mvex");
  if (!mvex) {
    throw new Fmp4CutError("Source isn't a fragmented MP4");
  }
  for (const trex of children(moov, mvex, "trex")) {
    const body = trex.start + trex.headerSize;
    const track = tracks.get(view.getUint32(body + 4));
    if (track) track.defaultSampleFlags = view.getUint32(body + 20);
  }

  return tracks;
}

const isSyncSample = (flags: number) => (flags & 0x00010000) === 0;

function parseMoof(moof: Uint8Array, tracks: Map<number, TrackInfo>): Omit<Fragment, "bytes" | "sourceOffset"> {
  const view = new DataView(moof.buffer, moof.byteOffset, moof.byteLength);
  const root = wholeBox(moof);
  let start = Infinity;
  let videoStart: number | null = null;
  let isVideo = false;
  let startsWithSync = true;
  const trackIds: number[] = [];

  for (const traf of children(moof, root, "traf")) {
    const tfhd = child(moof, traf, "tfhd");
    const tfdt = child(moof, traf, "tfdt");
    if (!tfhd || !tfdt) continue;

    const tfhdBody = tfhd.start + tfhd.headerSize;
    const tfhdFlags = view.getUint32(tfhdBody) & 0xffffff;
    const trackId = view.getUint32(tfhdBody + 4);
    const track = tracks.get(trackId);
    if (!track) continue;
    trackIds.push(trackId);

    const tfdtBody = tfdt.start + tfdt.headerSize;
    const decodeTime = moof[tfdtBody] === 1 ? Number(view.getBigUint64(tfdtBody + 4)) : view.getUint32(tfdtBody + 4);
    start = Math.min(start, decodeTime / track.timescale);

    if (track.kind !== "video") continue;
    isVideo = true;
    videoStart = decodeTime / track.timescale;

    // The first sample's flags: trun's first_sample_flags, else its
    // per-sample flags, else tfhd's default, else trex's default.
    let defaultFlags = track.defaultSampleFlags;
    let cursor = tfhdBody + 8;
    if (tfhdFlags & 0x1) cursor += 8;
    if (tfhdFlags & 0x2) cursor += 4;
    if (tfhdFlags & 0x8) cursor += 4;
    if (tfhdFlags & 0x10) cursor += 4;
    if (tfhdFlags & 0x20) defaultFlags = view.getUint32(cursor);

    const trun = child(moof, traf, "trun");
    let firstFlags = defaultFlags;
    if (trun) {
      const trunBody = trun.start + trun.headerSize;
      const trunFlags = view.getUint32(trunBody) & 0xffffff;
      let at = trunBody + 8;
      if (trunFlags & 0x1) at += 4;
      if (trunFlags & 0x4) {
        firstFlags = view.getUint32(at);
      } else if (trunFlags & 0x400) {
        if (trunFlags & 0x100) at += 4;
        if (trunFlags & 0x200) at += 4;
        firstFlags = view.getUint32(at);
      }
    }
    if (firstFlags !== null && !isSyncSample(firstFlags)) startsWithSync = false;
  }

  if (!Number.isFinite(start)) {
    throw new Fmp4CutError("Fragment has no decode time");
  }
  return { start, videoStart, isVideo, startsWithSync, trackIds };
}

/**
 * Moves a moof to its place in the cut:
 * - ffmpeg's fragmented output writes an absolute base_data_offset into
 *   every tfhd (the moof's own position in the file), so a moof moved by
 *   `byteShift` must have it moved by the same distance, or its samples
 *   point at the wrong bytes;
 * - each track's decode time moves back by `timeShift` seconds, in that
 *   track's own timescale.
 */
function rebaseMoof(moof: Uint8Array, tracks: Map<number, TrackInfo>, byteShift: number, timeShift: number): void {
  const view = new DataView(moof.buffer, moof.byteOffset, moof.byteLength);
  const root = wholeBox(moof);
  for (const traf of children(moof, root, "traf")) {
    const tfhd = child(moof, traf, "tfhd");
    const tfdt = child(moof, traf, "tfdt");
    if (!tfhd) continue;
    const tfhdBody = tfhd.start + tfhd.headerSize;
    if (byteShift !== 0 && view.getUint32(tfhdBody) & 0x1) {
      view.setBigUint64(tfhdBody + 8, view.getBigUint64(tfhdBody + 8) + BigInt(byteShift));
    }
    const track = tracks.get(view.getUint32(tfhdBody + 4));
    if (!tfdt || !track || timeShift === 0) continue;
    const ticks = Math.round(timeShift * track.timescale);
    const tfdtBody = tfdt.start + tfdt.headerSize;
    if (moof[tfdtBody] === 1) {
      const shifted = view.getBigUint64(tfdtBody + 4) - BigInt(ticks);
      view.setBigUint64(tfdtBody + 4, shifted < BigInt(0) ? BigInt(0) : shifted);
    } else {
      view.setUint32(tfdtBody + 4, Math.max(0, view.getUint32(tfdtBody + 4) - ticks));
    }
  }
}

/** Yields complete top-level boxes from a byte stream, with their offset in it. */
async function* topLevelBoxes(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<{ bytes: Uint8Array; offset: number }> {
  const reader = stream.getReader();
  let chunks: Uint8Array[] = [];
  let buffered = 0;
  let consumed = 0;
  let done = false;

  const take = (n: number): Uint8Array => {
    const out = new Uint8Array(n);
    let filled = 0;
    while (filled < n) {
      const head = chunks[0];
      const need = n - filled;
      if (head.byteLength <= need) {
        out.set(head, filled);
        filled += head.byteLength;
        chunks.shift();
      } else {
        out.set(head.subarray(0, need), filled);
        chunks[0] = head.subarray(need);
        filled += need;
      }
    }
    buffered -= n;
    return out;
  };

  const peek = (n: number): Uint8Array => {
    const out = new Uint8Array(n);
    let filled = 0;
    for (const chunk of chunks) {
      const part = chunk.subarray(0, n - filled);
      out.set(part, filled);
      filled += part.byteLength;
      if (filled === n) break;
    }
    return out;
  };

  const fill = async (n: number): Promise<boolean> => {
    while (buffered < n && !done) {
      const { value, done: finished } = await reader.read();
      if (finished) done = true;
      else if (value?.byteLength) {
        chunks.push(value);
        buffered += value.byteLength;
      }
    }
    return buffered >= n;
  };

  try {
    while (await fill(8)) {
      const header = peek(16 <= buffered ? 16 : 8);
      const view = new DataView(header.buffer);
      let size = view.getUint32(0);
      if (size === 1) {
        if (!(await fill(16))) break;
        size = Number(new DataView(peek(16).buffer).getBigUint64(8));
      } else if (size === 0) {
        // Box runs to the end of the stream.
        while (await fill(buffered + 1)) {
          if (buffered > MAX_BOX_BYTES) throw new Fmp4CutError("Box too large to cut while streaming");
        }
        size = buffered;
      }
      if (size < 8) throw new Fmp4CutError("Malformed box");
      if (size > MAX_BOX_BYTES) throw new Fmp4CutError("Box too large to cut while streaming");
      if (!(await fill(size))) break;
      const offset = consumed;
      consumed += size;
      yield { bytes: take(size), offset };
    }
  } finally {
    chunks = [];
    await reader.cancel().catch(() => {});
  }
}

export interface CutRange {
  /** Seconds, source timeline. */
  start: number;
  end: number;
}

/**
 * One range's cut, fed every fragment of the source in stream order. Holds
 * the fragments since the last keyframe until the range starts, then passes
 * fragments through until every track has passed the range's end.
 */
class RangeCutter {
  private pending: Fragment[] = [];
  private emitting = false;
  private written = 0;
  private timeShift = 0;
  private readonly pastEnd = new Set<number>();
  /** Source time at 0 in this cut, once it has started. */
  offset: number | null = null;
  done = false;

  constructor(
    private readonly range: CutRange,
    private readonly tracks: Map<number, TrackInfo>,
    private readonly head: Uint8Array[],
    private readonly maxBytes: number
  ) {}

  private emit(fragment: Fragment, out: Uint8Array[]) {
    // Copied: another range may pass the same fragment through.
    const moof = fragment.bytes[0].slice();
    rebaseMoof(moof, this.tracks, this.written - fragment.sourceOffset, this.timeShift);
    for (const part of [moof, ...fragment.bytes.slice(1)]) {
      this.written += part.byteLength;
      if (this.written > this.maxBytes) throw new Fmp4CutError("Clip range is too large");
      out.push(part);
    }
  }

  // The header goes out only once the first fragment is chosen: that's when
  // the time shift is known.
  private begin(first: Fragment[], out: Uint8Array[]) {
    this.emitting = true;
    this.timeShift = Math.min(...first.map((f) => f.start));
    this.offset = this.timeShift;
    for (const head of this.head) {
      this.written += head.byteLength;
      out.push(head);
    }
  }

  /** The bytes this fragment adds to the cut (often none). */
  offer(fragment: Fragment): Uint8Array[] {
    const out: Uint8Array[] = [];
    if (this.done) return out;
    if (!this.emitting) {
      // Video decides by its own track: the audio half of a fragment can
      // start a few ms earlier than the keyframe it travels with.
      if ((fragment.videoStart ?? fragment.start) <= this.range.start) {
        if (fragment.isVideo && fragment.startsWithSync) {
          const audio = this.pending.filter((f) => !f.isVideo);
          const lead = audio.filter((f) => f.start >= fragment.start - AUDIO_LEAD_SECONDS);
          // A long audio fragment that began before the lead can still be
          // playing at the keyframe; dropping it leaves the clip's start silent.
          const before = audio.filter((f) => f.start < fragment.start - AUDIO_LEAD_SECONDS).at(-1);
          this.pending = before ? [before, ...lead] : lead;
        }
        this.pending.push(fragment);
        return out;
      }
      this.begin([...this.pending, fragment], out);
      for (const held of this.pending) this.emit(held, out);
      this.pending = [];
    }

    if (fragment.start >= this.range.end) {
      for (const id of fragment.trackIds) this.pastEnd.add(id);
      const media = [...this.tracks.entries()].filter(([, t]) => t.kind !== "other").map(([id]) => id);
      this.done = media.every((id) => this.pastEnd.has(id)) || fragment.start >= this.range.end + END_SAFETY_SECONDS;
      return out;
    }
    this.emit(fragment, out);
    return out;
  }

  /** The end of the stream: whatever the range still holds. */
  finish(): Uint8Array[] {
    const out: Uint8Array[] = [];
    if (this.done) return out;
    if (!this.emitting && this.pending.length) {
      // The range runs past the end of the video.
      this.begin(this.pending, out);
      for (const held of this.pending) this.emit(held, out);
    }
    this.done = true;
    return out;
  }
}

export type CutEvent =
  | { type: "start"; index: number; offset: number }
  | { type: "data"; index: number; bytes: Uint8Array }
  | { type: "end"; index: number }
  /** How far into the source (seconds) the read has got. */
  | { type: "progress"; time: number };

const PROGRESS_EVERY_SECONDS = 2;

/**
 * Cuts several ranges out of one read of `stream`: each range becomes its
 * own small fMP4 (ftyp+moov, then its fragments, retimed to start at 0) and
 * is reported through `onEvent` as soon as the read passes it, so early
 * clips are ready long before the read reaches the last one. Stops reading
 * (and cancels the source) once every range is done. Throws Fmp4CutError if
 * the source isn't a fragmented MP4.
 */
export async function cutFragmentedMp4Ranges(
  stream: ReadableStream<Uint8Array>,
  ranges: CutRange[],
  onEvent: (event: CutEvent) => void | Promise<void>,
  {
    maxBytes = 400 * 1024 * 1024,
    requireAudio = false,
  }: {
    maxBytes?: number;
    /** Throw Fmp4CutError("no_audio") before cutting anything if the source has no audio track. */
    requireAudio?: boolean;
  } = {}
): Promise<void> {
  let ftyp: Uint8Array | null = null;
  let tracks: Map<number, TrackInfo> | null = null;
  let cutters: RangeCutter[] = [];
  let current: Fragment | null = null;
  let lastProgress = -Infinity;
  const announced = new Set<number>();

  const deliver = async (index: number, parts: Uint8Array[]) => {
    const cutter = cutters[index];
    if (parts.length && !announced.has(index)) {
      announced.add(index);
      await onEvent({ type: "start", index, offset: cutter.offset ?? 0 });
    }
    for (const bytes of parts) await onEvent({ type: "data", index, bytes });
    if (cutter.done) await onEvent({ type: "end", index });
  };

  // Returns true once every range is finished.
  const settle = async (fragment: Fragment): Promise<boolean> => {
    if (fragment.start - lastProgress >= PROGRESS_EVERY_SECONDS) {
      lastProgress = fragment.start;
      await onEvent({ type: "progress", time: fragment.start });
    }
    for (let index = 0; index < cutters.length; index++) {
      if (cutters[index].done) continue;
      await deliver(index, cutters[index].offer(fragment));
    }
    return cutters.every((cutter) => cutter.done);
  };

  for await (const { bytes: box, offset } of topLevelBoxes(stream)) {
    const type = readType(box, 4);
    if (type === "ftyp") {
      ftyp = box;
    } else if (type === "moov") {
      tracks = parseMoov(box);
      if (requireAudio && ![...tracks.values()].some((track) => track.kind === "audio")) {
        throw new Fmp4CutError("Source has no audio track", "no_audio");
      }
      const head = ftyp ? [ftyp, box] : [box];
      cutters = ranges.map((range) => new RangeCutter(range, tracks!, head, maxBytes));
    } else if (type === "moof") {
      if (!tracks) throw new Fmp4CutError("Fragment before moov");
      if (current && (await settle(current))) return;
      current = { ...parseMoof(box, tracks), sourceOffset: offset, bytes: [box] };
    } else if (type === "mdat") {
      if (!tracks) throw new Fmp4CutError("Source isn't a fragmented MP4");
      if (!current) continue;
      current.bytes.push(box);
      const fragment = current;
      current = null;
      if (await settle(fragment)) return;
    }
    // styp/sidx/free/emsg/mfra between fragments carry nothing a player needs.
  }

  if (current && (await settle(current))) return;
  for (let index = 0; index < cutters.length; index++) {
    if (!cutters[index].done) await deliver(index, cutters[index].finish());
  }
}
