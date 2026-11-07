// The loudness of a clip's audio over time, for the editor's timeline. Read
// from the clip's own cut (audio track only, decoded with WebCodecs via
// Mediabunny) and cached per cut, so switching clips or aspect is free.

import type { ClipSource } from "@/lib/client/clip-render";

export interface Waveform {
  /** Source time (seconds) of the first level. */
  start: number;
  /** Levels per second. */
  rate: number;
  /** Loudness, 0 (silence) to 1 (the clip's loud parts). */
  levels: Float32Array;
}

const LEVELS_PER_SECOND = 100;
const cache = new WeakMap<Blob, Promise<Waveform | null>>();

/** The cut's waveform, or null when its audio can't be decoded here. */
export function loadWaveform(source: ClipSource): Promise<Waveform | null> {
  let job = cache.get(source.blob);
  if (!job) {
    job = readWaveform(source).catch(() => null);
    cache.set(source.blob, job);
  }
  return job;
}

async function readWaveform(source: ClipSource): Promise<Waveform | null> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(source.blob), formats: mb.ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const duration = await track.computeDuration();
    if (!(duration > 0)) return null;

    // RMS per level: smoother than peaks, and closer to how loud it sounds.
    const count = Math.ceil(duration * LEVELS_PER_SECOND);
    const sums = new Float64Array(count);
    const frames = new Uint32Array(count);
    const sink = new mb.AudioSampleSink(track);
    for await (const sample of sink.samples()) {
      try {
        const n = sample.numberOfFrames;
        const data = new Float32Array(n);
        sample.copyTo(data, { planeIndex: 0, format: "f32-planar" });
        const perLevel = sample.sampleRate / LEVELS_PER_SECOND;
        const first = sample.timestamp * LEVELS_PER_SECOND;
        for (let i = 0; i < n; i++) {
          const level = Math.floor(first + i / perLevel);
          if (level < 0 || level >= count) continue;
          sums[level] += data[i] * data[i];
          frames[level]++;
        }
      } finally {
        sample.close();
      }
    }

    const levels = new Float32Array(count);
    for (let i = 0; i < count; i++) levels[i] = frames[i] ? Math.sqrt(sums[i] / frames[i]) : 0;
    // Scaled to the loud parts (98th percentile), so one spike doesn't flatten the rest.
    const sorted = Float32Array.from(levels).sort();
    const loud = sorted[Math.floor(sorted.length * 0.98)] || 1;
    for (let i = 0; i < count; i++) levels[i] = Math.min(1, levels[i] / loud);
    return { start: source.offset, rate: LEVELS_PER_SECOND, levels };
  } finally {
    input.dispose();
  }
}
