// Some of the provider's streams (seen 2026-11-19 on a 2:46:33 GTA stream)
// carry an AAC track whose esds has no AudioSpecificConfig: the two bytes
// that say "AAC-LC, 44.1 kHz, stereo". ffmpeg guesses past it; WebCodecs
// can't ("AAC description must be at least 2 bytes long"), so every cut of
// such a stream rendered silent: the browser filled the sound in from the
// project's mp3, and the render worker threw "sound didn't come through"
// three times over and handed the clip back.
//
// This rebuilds the missing config from the track itself (its sample entry's
// rate and channel count, AAC-LC as YouTube serves) and moves everything
// after the grown moov to match: in these fragmented MP4s every tfhd carries
// an absolute base_data_offset (ffmpeg's output, and fmp4-cut's cuts).
// Pure byte work with no imports, for the browser, the server and the worker.

interface Box {
  type: string;
  start: number;
  size: number;
  headerSize: number;
}

const SAMPLE_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
// MPEG-4 audio (0x40) and MPEG-2 AAC Main/LC/SSR (0x66-0x68) use an AudioSpecificConfig.
const AAC_OBJECT_TYPES = new Set([0x40, 0x66, 0x67, 0x68]);

function readType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function boxesIn(bytes: Uint8Array, start: number, end: number): Box[] {
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

const inside = (bytes: Uint8Array, box: Box, skip = 0) =>
  boxesIn(bytes, box.start + box.headerSize + skip, box.start + box.size);

/** A descriptor's tag, body start and body length, at `offset` in an esds. */
function readDescriptor(bytes: Uint8Array, offset: number, end: number) {
  if (offset + 2 > end) return null;
  const tag = bytes[offset];
  let length = 0;
  let cursor = offset + 1;
  for (let i = 0; i < 4 && cursor < end; i++) {
    const byte = bytes[cursor++];
    length = (length << 7) | (byte & 0x7f);
    if (!(byte & 0x80)) break;
  }
  if (cursor + length > end) return null;
  return { tag, body: cursor, length, end: cursor + length };
}

const descriptor = (tag: number, body: Uint8Array): Uint8Array => {
  if (body.byteLength > 127) throw new Error("descriptor too long");
  return Uint8Array.of(tag, body.byteLength, ...body);
};

/** AAC-LC's AudioSpecificConfig for this rate and channel count, or null for a rate it can't index. */
function audioSpecificConfig(sampleRate: number, channels: number): Uint8Array | null {
  const index = SAMPLE_RATES.indexOf(sampleRate);
  if (index < 0) return null;
  const config = (2 << 11) | (index << 7) | (Math.max(1, Math.min(7, channels)) << 3);
  return Uint8Array.of(config >> 8, config & 0xff);
}

/**
 * A rebuilt esds with an AudioSpecificConfig, or null when it has one
 * already (or isn't a layout this knows how to rebuild safely).
 */
function rebuildEsds(bytes: Uint8Array, esds: Box, sampleRate: number, channels: number): Uint8Array | null {
  const bodyStart = esds.start + esds.headerSize;
  const end = esds.start + esds.size;
  const es = readDescriptor(bytes, bodyStart + 4, end);
  if (!es || es.tag !== 0x03 || es.length < 3) return null;
  // ES_ID (2) and flags (1); optional fields (dependsOn, URL, OCR) are rare and left alone.
  if (bytes[es.body + 2] !== 0) return null;
  let decoderConfig: ReturnType<typeof readDescriptor> = null;
  let slConfig: ReturnType<typeof readDescriptor> = null;
  for (let cursor = es.body + 3; cursor < es.end; ) {
    const next = readDescriptor(bytes, cursor, es.end);
    if (!next) return null;
    if (next.tag === 0x04) decoderConfig = next;
    else if (next.tag === 0x06) slConfig = next;
    cursor = next.end;
  }
  if (!decoderConfig || decoderConfig.length < 13 || !AAC_OBJECT_TYPES.has(bytes[decoderConfig.body])) return null;
  // The DecoderConfigDescriptor's 13 fixed bytes, then its sub-descriptors:
  // a DecoderSpecificInfo (tag 5) of 2+ bytes means there's nothing to fix;
  // a shorter one is dropped and replaced; anything else is kept.
  const others: number[] = [];
  for (let cursor = decoderConfig.body + 13; cursor < decoderConfig.end; ) {
    const next = readDescriptor(bytes, cursor, decoderConfig.end);
    if (!next) return null;
    if (next.tag === 0x05 && next.length >= 2) return null;
    if (next.tag !== 0x05) others.push(...bytes.subarray(cursor, next.end));
    cursor = next.end;
  }
  const config = audioSpecificConfig(sampleRate, channels);
  if (!config) return null;

  const newDecoderConfig = descriptor(
    0x04,
    Uint8Array.of(...bytes.subarray(decoderConfig.body, decoderConfig.body + 13), ...descriptor(0x05, config), ...others)
  );
  const sl = slConfig ? bytes.subarray(slConfig.body, slConfig.end) : Uint8Array.of(0x02);
  const newEs = descriptor(
    0x03,
    Uint8Array.of(...bytes.subarray(es.body, es.body + 3), ...newDecoderConfig, ...descriptor(0x06, sl))
  );
  const out = new Uint8Array(8 + 4 + newEs.byteLength);
  new DataView(out.buffer).setUint32(0, out.byteLength);
  out.set([0x65, 0x73, 0x64, 0x73], 4); // "esds"
  out.set(bytes.subarray(bodyStart, bodyStart + 4), 8); // version and flags
  out.set(newEs, 12);
  return out;
}

/**
 * The moov with every AAC track's missing AudioSpecificConfig filled in, or
 * null if nothing needed it. Box sizes up the chain grow to match.
 */
export function repairMoovAacConfig(moov: Uint8Array): Uint8Array | null {
  const root: Box = { type: "moov", start: 0, size: moov.byteLength, headerSize: 8 };
  for (const trak of inside(moov, root).filter((box) => box.type === "trak")) {
    const mdia = inside(moov, trak).find((box) => box.type === "mdia");
    const minf = mdia && inside(moov, mdia).find((box) => box.type === "minf");
    const stbl = minf && inside(moov, minf).find((box) => box.type === "stbl");
    const stsd = stbl && inside(moov, stbl).find((box) => box.type === "stsd");
    // stsd: version/flags (4) and entry_count (4), then the sample entries.
    const mp4a = stsd && inside(moov, stsd, 8).find((box) => box.type === "mp4a");
    if (!mdia || !minf || !stbl || !stsd || !mp4a) continue;
    // AudioSampleEntry: 8 bytes of SampleEntry, 8 reserved, channel count, sample size, 4 more, rate (16.16).
    const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
    const entry = mp4a.start + mp4a.headerSize;
    const channels = view.getUint16(entry + 16);
    let sampleRate = view.getUint32(entry + 24) >>> 16;
    if (!SAMPLE_RATES.includes(sampleRate)) {
      // The rate field holds 16 bits; the media timescale is the rate itself for AAC.
      const mdhd = inside(moov, mdia).find((box) => box.type === "mdhd");
      if (mdhd) {
        const body = mdhd.start + mdhd.headerSize;
        sampleRate = view.getUint32(body + (moov[body] === 1 ? 20 : 12));
      }
    }
    const esds = inside(moov, mp4a, 28).find((box) => box.type === "esds");
    if (!esds) continue;
    const rebuilt = rebuildEsds(moov, esds, sampleRate, channels);
    if (!rebuilt) continue;

    const delta = rebuilt.byteLength - esds.size;
    const out = new Uint8Array(moov.byteLength + delta);
    out.set(moov.subarray(0, esds.start), 0);
    out.set(rebuilt, esds.start);
    out.set(moov.subarray(esds.start + esds.size), esds.start + rebuilt.byteLength);
    const outView = new DataView(out.buffer);
    for (const box of [root, trak, mdia, minf, stbl, stsd, mp4a]) {
      if (box.headerSize !== 8) return null; // 64-bit sizes: not worth rewriting
      outView.setUint32(box.start, box.size + delta);
    }
    // Any other AAC track gets the same treatment.
    return repairMoovAacConfig(out) ?? out;
  }
  return null;
}

/**
 * A whole fragmented MP4 (a clip's cut) with its AAC config filled in;
 * the same array when nothing needed it. Every moof after the moov has its
 * absolute tfhd base_data_offset moved by the bytes the moov grew; an mfra
 * (whose offsets would be stale, and which nothing here reads) is dropped.
 */
export function repairAacConfig(file: Uint8Array): Uint8Array {
  const top = boxesIn(file, 0, file.byteLength);
  const moovBox = top.find((box) => box.type === "moov");
  if (!moovBox) return file;
  const moov = file.subarray(moovBox.start, moovBox.start + moovBox.size);
  const repaired = repairMoovAacConfig(moov);
  if (!repaired) return file;
  const delta = repaired.byteLength - moov.byteLength;

  const kept = top.filter((box) => box.type !== "mfra");
  const tail = top.length ? top[top.length - 1].start + top[top.length - 1].size : 0;
  const total = kept.reduce((sum, box) => sum + box.size, 0) + delta + (file.byteLength - tail);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let at = 0;
  for (const box of kept) {
    if (box === moovBox) {
      out.set(repaired, at);
      at += repaired.byteLength;
      continue;
    }
    out.set(file.subarray(box.start, box.start + box.size), at);
    if (box.type === "moof" && box.start > moovBox.start) {
      const moof: Box = { ...box, start: at };
      for (const traf of inside(out, moof).filter((child) => child.type === "traf")) {
        const tfhd = inside(out, traf).find((child) => child.type === "tfhd");
        if (!tfhd) continue;
        const body = tfhd.start + tfhd.headerSize;
        if (view.getUint32(body) & 0x1) view.setBigUint64(body + 8, view.getBigUint64(body + 8) + BigInt(delta));
      }
    }
    at += box.size;
  }
  // Bytes past the last whole box (a partial one) go along as they were.
  out.set(file.subarray(tail), at);
  return out;
}

/** Whether a cut's head (its first bytes, through the moov) needs repairAacConfig. */
export function needsAacConfigRepair(head: Uint8Array): boolean {
  const moov = boxesIn(head, 0, head.byteLength).find((box) => box.type === "moov");
  return Boolean(moov && repairMoovAacConfig(head.subarray(moov.start, moov.start + moov.size)));
}
