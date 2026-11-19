import { LUMA_H, LUMA_W, type ReframeTrack } from "@/lib/client/clip-reframe";

// A face track as bytes, for a server render: the editor uploads the track it
// previewed with, so the worker frames the clip exactly as the user saw it
// (and never re-runs face tracking, which is ~4x slower than realtime on a
// server CPU). Layout, gzipped: a 4-byte length, the track as JSON without its
// grayscale frames, then each sample's LUMA_W x LUMA_H frame back to back
// (a flags byte per sample in the JSON says which samples have one).

const FORMAT = 1;
const FRAME_BYTES = LUMA_W * LUMA_H;

interface Header extends Omit<ReframeTrack, "luma"> {
  format: number;
  /** 1 where a sample has a grayscale frame, 0 where it's null. */
  lumaPresent: number[];
}

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodeTrack(track: ReframeTrack): Promise<Uint8Array> {
  const { luma, ...rest } = track;
  const header: Header = { ...rest, format: FORMAT, lumaPresent: luma.map((frame) => (frame ? 1 : 0)) };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const frames = luma.filter((frame): frame is Uint8Array => Boolean(frame));
  const raw = new Uint8Array(4 + json.byteLength + frames.length * FRAME_BYTES);
  new DataView(raw.buffer).setUint32(0, json.byteLength);
  raw.set(json, 4);
  let at = 4 + json.byteLength;
  for (const frame of frames) {
    raw.set(frame.subarray(0, FRAME_BYTES), at);
    at += FRAME_BYTES;
  }
  return pipeThrough(raw, new CompressionStream("gzip"));
}

export async function decodeTrack(gzipped: Uint8Array): Promise<ReframeTrack> {
  const raw = await pipeThrough(gzipped, new DecompressionStream("gzip"));
  const length = new DataView(raw.buffer, raw.byteOffset).getUint32(0);
  const header = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + length))) as Header;
  if (header.format !== FORMAT) throw new Error(`Unknown face track format ${header.format}`);
  let at = 4 + length;
  const luma = header.lumaPresent.map((present) => {
    if (!present) return null;
    const frame = raw.slice(at, at + FRAME_BYTES);
    at += FRAME_BYTES;
    return frame;
  });
  const { format: _format, lumaPresent: _present, ...rest } = header;
  void _format;
  void _present;
  return { ...rest, luma };
}

/** Hex SHA-256, for naming an upload by its content (the same track uploads once). */
export async function sha256Hex(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
