// Cuts one time range out of an MP3 *stream* without decoding it.
//
// The fallback for a clip whose video cut came without sound (the provider's
// merge of YouTube's audio and video lost the audio for part of the video):
// the project's mp3 -- the same audio its transcript was made from -- has
// it. An MP3 is a run of self-contained frames (each 1152 samples for
// MPEG-1 Layer III), so the cut is just the frames covering the range, and
// the time of the first one is reported as the cut's offset. Like the video
// stream, the provider's mp3 can't seek, so the read goes from the start up
// to the range, then stops (an hour at 128 kbps is ~58 MB).

export class Mp3CutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Mp3CutError";
  }
}

export interface Mp3Cut {
  /** The cut's frames, in order; together a playable MP3. */
  frames: Uint8Array[];
  /** Source time (seconds) at 0 in the decoded cut. */
  offset: number;
  sampleRate: number;
  /** How far the cut reaches (source seconds). */
  end: number;
}

// Frames kept before the range: Layer III frames can borrow bits from the
// frames before them (the bit reservoir), so the first one or two of a cut
// decode badly. They land in this lead, never in the clip.
const LEAD_SECONDS = 1;
const TAIL_SECONDS = 0.5;
// The decoder's own delay (an MPEG audio constant) and LAME's usual encoder
// delay, for files without a LAME tag saying how much it was.
const DECODER_DELAY = 529;
const DEFAULT_ENCODER_DELAY = 576;
const MAX_CUT_BYTES = 32 * 1024 * 1024;

const BITRATES_KBPS: Record<"v1" | "v2", Record<1 | 2 | 3, number[]>> = {
  v1: {
    1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  },
  v2: {
    1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  },
};
const SAMPLE_RATES: Record<0 | 2 | 3, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

interface FrameHeader {
  size: number;
  samples: number;
  sampleRate: number;
  /** Bytes from the frame start to where a Xing/Info header would sit. */
  sideInfoEnd: number;
}

/** The frame header at `at`, or null if those bytes aren't one. */
function readHeader(bytes: Uint8Array, at: number): FrameHeader | null {
  if (at + 4 > bytes.byteLength) return null;
  const b1 = bytes[at + 1];
  const b2 = bytes[at + 2];
  if (bytes[at] !== 0xff || (b1 & 0xe0) !== 0xe0) return null;
  const version = (b1 >> 3) & 3;
  const layerBits = (b1 >> 1) & 3;
  const bitrateIndex = b2 >> 4;
  const rateIndex = (b2 >> 2) & 3;
  if (version === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;

  const layer = (4 - layerBits) as 1 | 2 | 3;
  const mpeg1 = version === 3;
  const bitrate = BITRATES_KBPS[mpeg1 ? "v1" : "v2"][layer][bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[version as 0 | 2 | 3][rateIndex];
  const padding = (b2 >> 1) & 1;
  const mono = bytes[at + 3] >> 6 === 3;

  const samples = layer === 1 ? 384 : layer === 3 && !mpeg1 ? 576 : 1152;
  const size =
    layer === 1
      ? (Math.floor((12 * bitrate) / sampleRate) + padding) * 4
      : Math.floor(((layer === 3 && !mpeg1 ? 72 : 144) * bitrate) / sampleRate) + padding;
  const sideInfo = mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17;
  return { size, samples, sampleRate, sideInfoEnd: 4 + sideInfo };
}

const ascii = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.subarray(at, at + length));

/**
 * For a Xing/Info frame (the encoder's summary, no audio), the encoder delay
 * its LAME tag records; -1 if it has no readable tag. null if it's an audio frame.
 */
function infoFrameDelay(frame: Uint8Array, header: FrameHeader): number | null {
  const at = header.sideInfoEnd;
  const tag = ascii(frame, at, 4);
  if (tag === "VBRI") return -1;
  if (tag !== "Xing" && tag !== "Info") return null;
  const flags = new DataView(frame.buffer, frame.byteOffset).getUint32(at + 4);
  let lame = at + 8;
  if (flags & 1) lame += 4;
  if (flags & 2) lame += 4;
  if (flags & 4) lame += 100;
  if (flags & 8) lame += 4;
  if (lame + 24 > frame.byteLength || !/^[A-Za-z]{4}$/.test(ascii(frame, lame, 4))) return -1;
  return (frame[lame + 21] << 4) | (frame[lame + 22] >> 4);
}

/** Bytes to skip for an ID3v2 tag starting at `at` (0 if there's none there yet). */
function id3Size(bytes: Uint8Array, at: number): number {
  if (at + 10 > bytes.byteLength || ascii(bytes, at, 3) !== "ID3") return 0;
  const size = ((bytes[at + 6] & 0x7f) << 21) | ((bytes[at + 7] & 0x7f) << 14) | ((bytes[at + 8] & 0x7f) << 7) | (bytes[at + 9] & 0x7f);
  return 10 + size + (bytes[at + 5] & 0x10 ? 10 : 0);
}

/**
 * Reads `stream` up to the range and returns the MP3 frames covering
 * [from, to] (plus a short lead and tail), then cancels the stream.
 */
export async function cutMp3Range(stream: ReadableStream<Uint8Array>, from: number, to: number): Promise<Mp3Cut> {
  const reader = stream.getReader();
  let buffer = new Uint8Array(0);
  let position = 0;
  let done = false;

  // Makes sure `count` bytes from `position` are buffered (false at the stream's end).
  const ensure = async (count: number): Promise<boolean> => {
    while (buffer.byteLength - position < count && !done) {
      const { value, done: finished } = await reader.read();
      if (finished) {
        done = true;
        break;
      }
      if (!value?.byteLength) continue;
      const kept = buffer.subarray(position);
      const next = new Uint8Array(kept.byteLength + value.byteLength);
      next.set(kept);
      next.set(value, kept.byteLength);
      buffer = next;
      position = 0;
    }
    return buffer.byteLength - position >= count;
  };

  const frames: Uint8Array[] = [];
  let keptBytes = 0;
  let offset: number | null = null;
  let sampleRate = 0;
  let audioFrames = 0;
  let samplesSoFar = 0;
  let delay: number | null = null;
  let end = 0;
  let first = true;
  // Right after a whole frame the next header is where it should be; anywhere
  // else (the start, junk between frames) a header only counts if the frame
  // after it starts with one too, so stray 0xFF bytes can't pass for audio.
  let synced = false;

  try {
    for (;;) {
      if (!(await ensure(4))) break;
      if (buffer[position] === 0x49 && (await ensure(10))) {
        const skip = id3Size(buffer, position);
        if (skip) {
          if (!(await ensure(skip))) break;
          position += skip;
          synced = false;
          continue;
        }
      }

      const header = readHeader(buffer, position);
      if (!header) {
        position += 1;
        synced = false;
        continue;
      }
      if (!synced && (await ensure(header.size + 4)) && !readHeader(buffer, position + header.size)) {
        position += 1;
        continue;
      }
      // The stream's last frame may be cut short.
      if (!(await ensure(header.size))) break;
      synced = true;
      const frame = buffer.subarray(position, position + header.size);
      position += header.size;

      if (first) {
        first = false;
        sampleRate = header.sampleRate;
        const info = infoFrameDelay(frame, header);
        if (info !== null) {
          delay = DECODER_DELAY + (info >= 0 ? info : DEFAULT_ENCODER_DELAY);
          continue;
        }
      }
      if (header.sampleRate !== sampleRate) continue;
      const totalDelay = delay ?? DECODER_DELAY + DEFAULT_ENCODER_DELAY;

      // Where this frame's decoded audio sits on the source timeline.
      const start = (samplesSoFar - totalDelay) / sampleRate;
      samplesSoFar += header.samples;
      audioFrames++;
      const frameEnd = (samplesSoFar - totalDelay) / sampleRate;
      if (frameEnd <= from - LEAD_SECONDS) continue;
      if (start >= to + TAIL_SECONDS) break;

      if (offset === null) offset = start;
      frames.push(frame.slice());
      keptBytes += frame.byteLength;
      end = frameEnd;
      if (keptBytes > MAX_CUT_BYTES) throw new Mp3CutError("Audio range is too large");
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  if (!audioFrames) throw new Mp3CutError("The audio isn't an MP3 stream");
  if (offset === null || end <= from) throw new Mp3CutError("The audio ends before this clip");
  return { frames, offset, sampleRate, end };
}
