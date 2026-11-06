// In-browser voice recording for the Clone a voice form. MediaRecorder only
// writes what the browser can encode -- WebM/Opus in Chrome and Firefox,
// MP4/AAC in Safari -- and MiniMax takes none of those as a sample, so a
// finished take is decoded and re-encoded here as a 16-bit mono WAV, then
// goes through the same signed upload as a picked file. On the way it is
// resampled to 32kHz (MiniMax's own speech rate, and five minutes of it
// stays under the 20MB sample limit), trimmed of the dead air around the
// speech, peak-normalised, and measured, so the form can flag a take that
// would clone poorly before anyone pays for it.
import { CLONE_SAMPLE_MAX_SECONDS } from "@/lib/config/voices";
import { encodeWav } from "./audio-export";

const SAMPLE_RATE = 32_000;
const FRAME_SECONDS = 0.02;
const LEAD_PAD_SECONDS = 0.25;
const TAIL_PAD_SECONDS = 0.4;
const TARGET_PEAK = 10 ** (-1 / 20); // -1 dBFS
const MAX_GAIN = 10 ** (18 / 20); // +18dB, so a near-silent take isn't blown up into pure noise
const CLIP_LEVEL = 0.995;
const WAVEFORM_BARS = 64;

// Browsers tune the mic for calls: echo cancellation, noise suppression and
// auto gain all reshape the voice, and a clone copies whatever it's given.
// The raw signal clones closer -- MiniMax normalises the volume itself, and
// the form's "Reduce background noise" option is its own noise reduction.
export const RECORDING_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

// No timeslice is used when recording: Safari's MP4 fragments from a sliced
// recording don't always decode once joined back together.
const RECORDER_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

export function isRecordingSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}

/** The first container this browser can record into, or "" to let it choose. */
export function pickRecorderType(): string {
  return RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

/** 0-1 loudness of a stretch of live mic samples, on a -60..0 dBFS scale. */
export function meterLevel(samples: Float32Array): { level: number; peak: number } {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i];
    sum += value * value;
    const abs = Math.abs(value);
    if (abs > peak) peak = abs;
  }
  const db = toDb(Math.sqrt(sum / samples.length));
  return { level: Math.min(1, Math.max(0, (db + 60) / 60)), peak };
}

/** Worst first -- a take only reports its most important problem. */
export type RecordingIssue = "sparse" | "clipping" | "noisy" | "quiet";

export interface ProcessedRecording {
  file: File;
  durationSeconds: number;
  /** 0-1 bar heights for drawing the take. */
  waveform: number[];
  issue: RecordingIssue | null;
}

function toDb(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -120;
}

function percentile(sorted: Float32Array, fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

function drawWaveform(samples: Float32Array): number[] {
  const bucket = Math.max(1, Math.floor(samples.length / WAVEFORM_BARS));
  const levels: number[] = [];
  for (let bar = 0; bar < WAVEFORM_BARS; bar++) {
    let sum = 0;
    const start = bar * bucket;
    const end = Math.min(samples.length, start + bucket);
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    levels.push(end > start ? Math.sqrt(sum / (end - start)) : 0);
  }
  const loudest = Math.max(...levels) || 1;
  return levels.map((level) => Math.max(0.06, Math.sqrt(level / loudest)));
}

export async function processRecording(recording: Blob): Promise<ProcessedRecording> {
  // Decoding through a 32kHz context resamples the take on the way in.
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const decoded = await context.decodeAudioData(await recording.arrayBuffer());

  const length = Math.min(decoded.length, Math.floor(CLONE_SAMPLE_MAX_SECONDS * SAMPLE_RATE));
  const mono = new Float32Array(length);
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const data = decoded.getChannelData(channel);
    for (let i = 0; i < length; i++) mono[i] += data[i] / decoded.numberOfChannels;
  }

  // Loudness per 20ms frame: the quiet end is the room, the loud end is the
  // voice, and anything clearly above the room counts as speech.
  const frameSize = Math.round(FRAME_SECONDS * SAMPLE_RATE);
  const frameCount = Math.floor(length / frameSize);
  if (frameCount === 0) return { file: toWavFile(context, mono), durationSeconds: length / SAMPLE_RATE, waveform: [], issue: "sparse" };

  const frameDb = new Float32Array(frameCount);
  let clipped = 0;
  for (let frame = 0; frame < frameCount; frame++) {
    let sum = 0;
    for (let i = frame * frameSize; i < (frame + 1) * frameSize; i++) {
      sum += mono[i] * mono[i];
      if (Math.abs(mono[i]) >= CLIP_LEVEL) clipped++;
    }
    frameDb[frame] = toDb(Math.sqrt(sum / frameSize));
  }
  const sorted = frameDb.slice().sort();
  const noiseFloorDb = percentile(sorted, 0.1);
  const speechDb = percentile(sorted, 0.95);
  const speechThresholdDb = Math.max(-55, noiseFloorDb + 10);

  let firstActive = -1;
  let lastActive = -1;
  let activeFrames = 0;
  for (let frame = 0; frame < frameCount; frame++) {
    if (frameDb[frame] < speechThresholdDb) continue;
    if (firstActive < 0) firstActive = frame;
    lastActive = frame;
    activeFrames++;
  }

  const start = firstActive < 0 ? 0 : Math.max(0, firstActive * frameSize - Math.round(LEAD_PAD_SECONDS * SAMPLE_RATE));
  const end = lastActive < 0 ? length : Math.min(length, (lastActive + 1) * frameSize + Math.round(TAIL_PAD_SECONDS * SAMPLE_RATE));
  const take = mono.subarray(start, end);

  let peak = 0;
  for (let i = 0; i < take.length; i++) peak = Math.max(peak, Math.abs(take[i]));
  const gain = peak > 0 ? Math.min(TARGET_PEAK / peak, MAX_GAIN) : 1;
  for (let i = 0; i < take.length; i++) take[i] *= gain;

  let issue: RecordingIssue | null = null;
  if (activeFrames * FRAME_SECONDS < 5) issue = "sparse";
  else if (clipped / length > 1e-4) issue = "clipping";
  else if (speechDb - noiseFloorDb < 20) issue = "noisy";
  else if (speechDb < -40) issue = "quiet";

  return { file: toWavFile(context, take), durationSeconds: take.length / SAMPLE_RATE, waveform: drawWaveform(take), issue };
}

function toWavFile(context: OfflineAudioContext, samples: Float32Array): File {
  const buffer = context.createBuffer(1, Math.max(1, samples.length), SAMPLE_RATE);
  buffer.getChannelData(0).set(samples);
  return new File([encodeWav(buffer)], "recording.wav", { type: "audio/wav" });
}
