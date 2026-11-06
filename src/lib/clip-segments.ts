// The wire format of POST /api/clips/[id]/segments: one response carrying
// several clip cuts plus progress, as a sequence of frames:
//   [type: u8][clip index: u8][payload length: u32 BE][payload]
// Shared by the route that writes it and the browser code that reads it.

export const SEGMENT_FRAME = {
  /** The cut started; payload: float64 source time at 0 in the cut. */
  start: 1,
  /** Payload: the next bytes of the cut (an fMP4). */
  data: 2,
  /** The cut is complete. */
  end: 3,
  /** Payload: float64 seconds into the source the read has reached. Index unused. */
  progress: 4,
  /** Payload: UTF-8 message. Index 255 means every unfinished clip. */
  error: 5,
} as const;

export const SEGMENT_ALL = 255;
export const SEGMENT_HEADER_BYTES = 6;
/** Most clips one request may cut. */
export const SEGMENT_MAX_RANGES = 12;

export function encodeSegmentFrame(type: number, index: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  const frame = new Uint8Array(SEGMENT_HEADER_BYTES + payload.byteLength);
  const view = new DataView(frame.buffer);
  view.setUint8(0, type);
  view.setUint8(1, index);
  view.setUint32(2, payload.byteLength);
  frame.set(payload, SEGMENT_HEADER_BYTES);
  return frame;
}

export function float64(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value);
  return bytes;
}
