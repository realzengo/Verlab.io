// Reads an MP4/MOV clip's real duration straight from its ISO-BMFF headers
// (moov > mvhd) over HTTP Range requests -- no ffmpeg dependency, and only a
// few small reads rather than downloading the whole file. Exists because the
// upload flow's durationSeconds is reported by the browser: anything billed
// per second of the *source* clip (the Clone tab -- Kling bills the full
// clip) must price off the file itself, or a forged duration undercharges.

const BOX_HEADER_BYTES = 16; // size(4) + type(4) + optional 64-bit largesize(8)
const MVHD_READ_BYTES = 512; // mvhd is moov's first child in practice; this covers it plus any preceding small box
const MAX_TOP_LEVEL_BOXES = 32;

async function readRange(url: string, start: number, length: number): Promise<{ bytes: Buffer; totalSize: number | null } | null> {
  const response = await fetch(url, { headers: { Range: `bytes=${start}-${start + length - 1}` } }).catch(() => null);
  if (!response || (response.status !== 206 && response.status !== 200)) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  // A server that ignores Range answers 200 with the whole body -- slice it
  // so the caller still sees exactly the window it asked for.
  const windowed = response.status === 200 ? bytes.subarray(start, start + length) : bytes;
  const totalSize = Number(response.headers.get("content-range")?.split("/")[1]);
  return { bytes: windowed, totalSize: Number.isFinite(totalSize) ? totalSize : response.status === 200 ? bytes.length : null };
}

function parseMvhdDuration(box: Buffer): number | null {
  const version = box[0];
  // version(1) flags(3), then creation/modification times (4 or 8 bytes each), timescale(4), duration(4 or 8)
  const timescaleOffset = version === 1 ? 4 + 16 : 4 + 8;
  if (box.length < timescaleOffset + (version === 1 ? 12 : 8)) return null;
  const timescale = box.readUInt32BE(timescaleOffset);
  const duration = version === 1 ? Number(box.readBigUInt64BE(timescaleOffset + 4)) : box.readUInt32BE(timescaleOffset + 4);
  if (!timescale || !duration) return null;
  return duration / timescale;
}

/** Duration in seconds, or null when the file isn't a readable MP4/MOV. */
export async function readMp4DurationSeconds(url: string): Promise<number | null> {
  let offset = 0;
  let fileSize: number | null = null;

  for (let i = 0; i < MAX_TOP_LEVEL_BOXES; i++) {
    if (fileSize !== null && offset >= fileSize) return null;

    const header = await readRange(url, offset, BOX_HEADER_BYTES);
    if (!header || header.bytes.length < 8) return null;
    fileSize ??= header.totalSize;

    let size = header.bytes.readUInt32BE(0);
    const type = header.bytes.toString("latin1", 4, 8);
    let headerSize = 8;
    if (size === 1) {
      if (header.bytes.length < 16) return null;
      size = Number(header.bytes.readBigUInt64BE(8));
      headerSize = 16;
    } else if (size === 0) {
      if (fileSize === null) return null;
      size = fileSize - offset; // box runs to end of file
    }
    if (size < headerSize) return null;

    if (type === "moov") {
      const moov = await readRange(url, offset + headerSize, Math.min(MVHD_READ_BYTES, size - headerSize));
      if (!moov) return null;
      // Walk moov's children until mvhd turns up within the read window.
      let childOffset = 0;
      while (childOffset + 8 <= moov.bytes.length) {
        const childSize = moov.bytes.readUInt32BE(childOffset);
        const childType = moov.bytes.toString("latin1", childOffset + 4, childOffset + 8);
        if (childType === "mvhd") return parseMvhdDuration(moov.bytes.subarray(childOffset + 8, childOffset + childSize));
        if (childSize < 8) return null;
        childOffset += childSize;
      }
      return null;
    }

    offset += size;
  }

  return null;
}
