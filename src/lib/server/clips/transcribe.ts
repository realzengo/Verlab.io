import "server-only";
import { getReplicateClient, withReplicateRetry } from "@/lib/server/replicate-client";
import type { TranscriptWord } from "@/lib/clips";

// WhisperX (large-v3 + wav2vec2 alignment) on Replicate: word-level timings,
// which the captions need, for any video with speech -- captions or not.
// Verified 2026-11-06: a 54-minute video transcribed in ~105s of GPU time.
// It must be fed the provider's mp3, not m4a: the streamed m4a of a long
// video decodes as corrupt AAC in the model's ffmpeg.
// Community model, so predictions are created against a pinned version.
const WHISPERX_VERSION = "655845d6190ef70573c669245f245892cd039df4b880a1e3a65852c09252f5cc";

interface WhisperxWord {
  word?: string;
  start?: number;
  end?: number;
}

interface WhisperxOutput {
  detected_language?: string;
  segments?: { start?: number; end?: number; text?: string; words?: WhisperxWord[] }[];
}

export type TranscriptionState =
  | { status: "running" }
  | { status: "failed"; error: string }
  | { status: "succeeded"; words: TranscriptWord[]; language: string | null };

export async function startTranscription(audioUrl: string): Promise<string> {
  const replicate = getReplicateClient();
  const prediction = await withReplicateRetry(() =>
    replicate.predictions.create({
      version: WHISPERX_VERSION,
      input: { audio_file: audioUrl, align_output: true, batch_size: 64 },
    })
  );
  return prediction.id;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Flattens WhisperX segments into timed words. Alignment occasionally leaves
 * a word (often a number) without timings; it gets the gap between its
 * neighbours, falling back to its segment's bounds.
 */
export function wordsFromWhisperx(output: WhisperxOutput): TranscriptWord[] {
  const words: TranscriptWord[] = [];
  for (const segment of output.segments ?? []) {
    const list = (segment.words ?? []).filter((w) => w.word?.trim());
    const segStart = segment.start ?? 0;
    const segEnd = segment.end ?? segStart;
    list.forEach((word, index) => {
      const prevEnd = words.length ? words[words.length - 1][1] : segStart;
      const nextStart = list.slice(index + 1).find((w) => typeof w.start === "number")?.start ?? segEnd;
      const start = typeof word.start === "number" ? word.start : Math.max(prevEnd, segStart);
      const end = typeof word.end === "number" ? word.end : Math.max(start, nextStart);
      words.push([round(start), round(Math.max(start, end)), word.word!.trim()]);
    });
  }
  return words;
}

export async function getTranscription(predictionId: string): Promise<TranscriptionState> {
  const replicate = getReplicateClient();
  const prediction = await withReplicateRetry(() => replicate.predictions.get(predictionId));
  if (prediction.status === "succeeded") {
    const output = (prediction.output ?? {}) as WhisperxOutput;
    return { status: "succeeded", words: wordsFromWhisperx(output), language: output.detected_language ?? null };
  }
  if (prediction.status === "failed" || prediction.status === "canceled") {
    return { status: "failed", error: String(prediction.error ?? prediction.status).slice(0, 500) };
  }
  return { status: "running" };
}
