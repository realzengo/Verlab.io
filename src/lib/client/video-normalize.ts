// Converts any uploaded clip into one shape every video provider accepts,
// entirely in the browser (WebCodecs via Mediabunny -- hardware encoding,
// typically a few seconds for a 30s clip; the server has no ffmpeg).
//
// Why every upload is re-encoded rather than only "suspicious" ones: provider
// ingest pipelines reject inputs for reasons that are invisible until a paid
// job fails minutes later -- confirmed live with Kling 4.0, which refused a
// 716x726 clip whose sample aspect ratio was 49005:49046 ("VideoNormalize
// failed, non-square pixels detected"), a near-square value that's easy to
// miss and common in clips re-exported by editing apps. Other known traps
// are rotation metadata some models ignore, HEVC/ProRes/10-bit sources,
// >1080p frames, and >30fps. One deterministic output removes the whole
// class instead of patching each as it's discovered:
//
//   H.264 · square pixels · rotation baked into the frames · even dimensions
//   fitted within 1920x1080, short side >=720 · <=30fps · AAC audio (copied when already AAC)
//   · MP4 with the moov box up front (fast server-side duration probing).

import type { InputVideoTrack } from "mediabunny";

export interface NormalizedVideo {
  file: File;
  durationSeconds: number;
  width: number;
  height: number;
}

const MAX_LONG_SIDE = 1920;
const MAX_SHORT_SIDE = 1080;
// Kling's Omni editors refuse anything under 720px per side (Kling 4.0 under
// 700), so small clips are scaled up rather than failing after a paid queue.
const MIN_SHORT_SIDE = 720;
const MAX_FRAME_RATE = 30;

export class VideoNormalizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoNormalizeError";
  }
}

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

/**
 * Display size (pixel aspect + rotation applied) fitted within 1920x1080 in
 * either orientation, and scaled up so the short side reaches 720px where
 * that doesn't push the long side past 1920.
 */
function targetSize(displayWidth: number, displayHeight: number): { width: number; height: number } {
  const long = Math.max(displayWidth, displayHeight);
  const short = Math.min(displayWidth, displayHeight);
  const fit = Math.min(MAX_LONG_SIDE / long, MAX_SHORT_SIDE / short);
  const scale = Math.min(fit, Math.max(1, MIN_SHORT_SIDE / short));
  // Rounding to even can land a hair under the minimum (719 -> 718), so round up there.
  const size = (side: number) => (side === short && scale > 1 ? Math.ceil((side * scale) / 2) * 2 : even(side * scale));
  return { width: size(displayWidth), height: size(displayHeight) };
}

interface Box {
  type: string;
  start: number;
  size: number;
  headerSize: number;
}

function readBoxes(view: DataView, start: number, end: number): Box[] {
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
    const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
    boxes.push({ type, start: offset, size, headerSize });
    offset += size;
  }
  return boxes;
}

function child(view: DataView, parent: Box, type: string, skip = 0): Box | undefined {
  return readBoxes(view, parent.start + parent.headerSize + skip, parent.start + parent.size).find((box) => box.type === type);
}

// avc1 sample entry fields before its child boxes (ISO/IEC 14496-12 VisualSampleEntry).
const VISUAL_SAMPLE_ENTRY_FIELDS = 78;
// stsd's own version/flags + entry_count, before the sample entries.
const STSD_HEADER_FIELDS = 8;

/**
 * Adds an explicit 1:1 `pasp` box to the H.264 sample entry. Mediabunny
 * (correctly, per spec) omits it for square pixels, but then ffprobe-based
 * ingest reports the aspect as "N/A" rather than "1:1" -- not worth betting a
 * paid job on a provider treating those the same. Inserting 16 bytes inside
 * moov means growing every ancestor's size and shifting every chunk offset
 * that points past the insertion (mdat sits after moov with fastStart).
 * Returns the input untouched if the layout isn't the expected one.
 */
function withExplicitSquarePixels(buffer: ArrayBuffer): ArrayBuffer {
  const view = new DataView(buffer);
  const moov = readBoxes(view, 0, buffer.byteLength).find((box) => box.type === "moov");
  if (!moov) return buffer;

  for (const trak of readBoxes(view, moov.start + moov.headerSize, moov.start + moov.size).filter((box) => box.type === "trak")) {
    const mdia = child(view, trak, "mdia");
    const minf = mdia && child(view, mdia, "minf");
    const stbl = minf && child(view, minf, "stbl");
    const stsd = stbl && child(view, stbl, "stsd");
    const avc1 = stsd && child(view, stsd, "avc1", STSD_HEADER_FIELDS);
    if (!mdia || !minf || !stbl || !stsd || !avc1) continue;
    if (child(view, avc1, "pasp", VISUAL_SAMPLE_ENTRY_FIELDS)) return buffer;

    const ancestors = [moov, trak, mdia, minf, stbl, stsd, avc1];
    if (ancestors.some((box) => box.headerSize !== 8)) return buffer;

    const insertAt = avc1.start + avc1.size;
    const pasp = new Uint8Array([0, 0, 0, 16, 0x70, 0x61, 0x73, 0x70, 0, 0, 0, 1, 0, 0, 0, 1]); // "pasp", hSpacing 1, vSpacing 1
    const next = new Uint8Array(buffer.byteLength + pasp.length);
    next.set(new Uint8Array(buffer, 0, insertAt), 0);
    next.set(pasp, insertAt);
    next.set(new Uint8Array(buffer, insertAt), insertAt + pasp.length);

    const out = new DataView(next.buffer);
    for (const box of ancestors) out.setUint32(box.start, box.size + pasp.length);

    // Every trak's chunk offsets that point past the insertion move with it.
    const newMoov: Box = { ...moov, size: moov.size + pasp.length };
    for (const anyTrak of readBoxes(out, newMoov.start + 8, newMoov.start + newMoov.size).filter((box) => box.type === "trak")) {
      const table = (() => {
        const m = child(out, anyTrak, "mdia");
        const i = m && child(out, m, "minf");
        const s = i && child(out, i, "stbl");
        return s && (child(out, s, "stco") ?? child(out, s, "co64"));
      })();
      if (!table) continue;
      const count = out.getUint32(table.start + 12);
      for (let n = 0; n < count; n++) {
        if (table.type === "stco") {
          const at = table.start + 16 + n * 4;
          const value = out.getUint32(at);
          if (value >= insertAt) out.setUint32(at, value + pasp.length);
        } else {
          const at = table.start + 16 + n * 8;
          const value = out.getBigUint64(at);
          if (value >= BigInt(insertAt)) out.setBigUint64(at, value + BigInt(pasp.length));
        }
      }
    }
    return next.buffer;
  }
  return buffer;
}

async function sourceFrameRate(track: InputVideoTrack): Promise<number | null> {
  try {
    const stats = await track.computePacketStats(100);
    return Number.isFinite(stats.averagePacketRate) && stats.averagePacketRate > 0 ? stats.averagePacketRate : null;
  } catch {
    return null;
  }
}

export interface NormalizeOptions {
  /** Receives 0..1 while encoding. */
  onProgress?: (progress: number) => void;
  /**
   * Runs once the file's metadata is read, before any encoding -- throw to
   * abort (e.g. a clip that's too long), so the user isn't made to wait
   * through a conversion that would be rejected anyway.
   */
  beforeConvert?: (info: { durationSeconds: number; width: number; height: number }) => void;
}

/**
 * Re-encodes `file` into the provider-safe shape described above. Throws
 * VideoNormalizeError with a user-facing message when the file can't be read
 * or the browser can't encode H.264; errors thrown by `beforeConvert`
 * propagate as-is.
 */
export async function normalizeVideoForProviders(file: File, { onProgress, beforeConvert }: NormalizeOptions = {}): Promise<NormalizedVideo> {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeAudio, canEncodeVideo } =
    await import("mediabunny");

  if (typeof VideoEncoder === "undefined") {
    throw new VideoNormalizeError("Your browser can't prepare videos for upload. Use a recent Chrome, Edge or Safari.");
  }

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const videoTrack = await input.getPrimaryVideoTrack().catch(() => null);
    if (!videoTrack) throw new VideoNormalizeError("We couldn't read a video track from that file. Try an MP4 or MOV export.");

    const [displayWidth, displayHeight, durationSeconds, frameRate, audioTrack] = await Promise.all([
      videoTrack.getDisplayWidth(),
      videoTrack.getDisplayHeight(),
      input.computeDuration(),
      sourceFrameRate(videoTrack),
      input.getPrimaryAudioTrack().catch(() => null),
    ]);
    const { width, height } = targetSize(displayWidth, displayHeight);
    try {
      beforeConvert?.({ durationSeconds, width: displayWidth, height: displayHeight });
    } catch (error) {
      throw new VideoNormalizeError(error instanceof Error ? error.message : "That video can't be used.");
    }

    if (!(await canEncodeVideo("avc", { width, height }))) {
      throw new VideoNormalizeError("Your browser can't encode H.264 video. Use a recent Chrome, Edge or Safari.");
    }
    // AAC is copied untouched when the source already has it; other audio is
    // re-encoded to AAC where the browser can (Opus otherwise -- still MP4-legal).
    const audioCodec = (await audioTrack?.getCodec()) === "aac" || (await canEncodeAudio("aac")) ? "aac" : "opus";

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        width,
        height,
        fit: "fill",
        codec: "avc",
        quality: QUALITY_HIGH,
        // Always re-encode: copying packets would carry the source's pixel
        // aspect ratio and rotation flags straight through.
        forceTranscode: true,
        allowTransformationMetadata: false,
        ...(frameRate && frameRate > MAX_FRAME_RATE + 0.5 ? { frameRate: MAX_FRAME_RATE } : {}),
      },
      audio: { codec: audioCodec },
    });

    if (!conversion.isValid || !conversion.utilizedTracks.some((track) => track.isVideoTrack())) {
      const reason = conversion.discardedTracks.find((entry) => entry.track.isVideoTrack())?.reason;
      throw new VideoNormalizeError(`We couldn't convert this video${reason ? ` (${reason.replace(/_/g, " ")})` : ""}. Try an MP4 or MOV export.`);
    }

    if (onProgress) conversion.onProgress = (progress) => onProgress(Math.min(1, Math.max(0, progress)));
    await conversion.execute();

    const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
    if (!buffer) throw new VideoNormalizeError("Video conversion produced no output. Try again.");

    const name = `${file.name.replace(/\.[^.]+$/, "") || "video"}.mp4`;
    return { file: new File([withExplicitSquarePixels(buffer)], name, { type: "video/mp4" }), durationSeconds, width, height };
  } catch (error) {
    if (error instanceof VideoNormalizeError) throw error;
    console.error("[video-normalize]", error);
    throw new VideoNormalizeError("We couldn't convert this video. Try a different file or an MP4 export.");
  } finally {
    input.dispose();
  }
}
