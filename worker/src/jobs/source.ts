import { spawn } from "node:child_process";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { finished, pipeline } from "node:stream/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClipJobStage } from "@/lib/clip-jobs";
import { UPSTREAM_HEADERS } from "@/lib/server/clips/cut-source";
import {
  AUDIO_CHUNK_SECONDS,
  AUDIO_SAMPLE_RATE,
  TRANSCRIBE_AUDIO_BUCKET,
  transcribeAudioKbps,
  transcribeAudioPath,
} from "@/lib/server/clips/transcribe-audio";
import { VideoProviderError, fetchDownloadLink, type DownloadRange } from "@/lib/server/video-provider";
import { probeStreams } from "../media";
import { log } from "../log";
import { JobError } from "./render";

// A project's audio for WhisperX (see src/lib/server/clips/transcribe-audio.ts),
// stored where the app hands it to Replicate. The project itself is left
// alone; the app sees this job done and starts the transcription.
//
// The audio is taken in 15-minute stretches, each from whichever of two
// sources delivers it first (measured 2026-11-19 on a 58-minute video):
//   - the provider's mp3 stream: starts in seconds and arrives in order at
//     ~9x realtime (a 2-hour video in ~13 minutes), so it covers the early
//     stretches and is the floor for the rest. Replicate's downloader gave up
//     on it after ~10s of silence; here it gets a minute, and a fresh link
//     if it stalls;
//   - trimmed downloads of the later stretches, several at once: usually
//     ready in 1-2 minutes, but the provider sometimes takes 10+ minutes to
//     convert one, which the stream then covers instead.
// The stretches are stitched at their exact starts into 16 kHz mono (all
// Whisper listens to) and encoded to Opus sized under the bucket's 50MB cap.

const TRIM_CONCURRENCY = 6;
// Both sources are retried until every stretch is in or the job's time is up
// (2026-11-19 the provider stalled streams at 32 and 2.5 minutes in a row and
// left most trims stuck), pausing a little longer after each failure.
const retryPause = (attempt: number) => Math.min(30_000, 3_000 * (attempt + 1));
/** A provider job whose progress doesn't move for this long is given up (trims can sit ~40s at "Initialising"). */
const LINK_STALL_MS = 90_000;
/** Longest wait for a trimmed stretch's link (the stream covers it meanwhile). */
const TRIM_LINK_TIMEOUT_MS = 5 * 60_000;
const FIRST_BYTE_MS = 60_000;
const STALL_MS = 60_000;
/** How far the stream's decoded length may fall short of the video's and still count as all of it. */
const SHORT_SLACK_SECONDS = 2;
/**
 * A trimmed stretch must be this close to the length asked for. Measured
 * 2026-11-19: good ones land within 0.03s; now and then the provider starts
 * one ~1s late (and it comes back ~1s short), which would put a whole
 * stretch's captions a second off, so it's refused and asked for again.
 */
const TRIM_LENGTH_TOLERANCE_SECONDS = 0.3;
/** Seconds past each stretch's end, so stitching never runs short. */
const TAIL_SECONDS = 2;
/**
 * The longest fetching may take before the job is given up (the app then
 * falls back to the provider's link): room for the stream alone to deliver
 * the whole video (~9x realtime) with margin, 10 to 35 minutes.
 */
const fetchMaxMs = (durationSeconds: number) => Math.min(35 * 60_000, Math.max(10 * 60_000, (durationSeconds / 6) * 1000));
const BYTES_PER_SECOND = AUDIO_SAMPLE_RATE * 2;

/** Waits `ms`, or until `signal` aborts. */
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });

export interface SourceJob {
  id: string;
  project_id: string;
  user_id: string;
  input: Record<string, unknown>;
}

interface Chunk {
  /** Where this stretch sits in the finished audio (seconds). */
  from: number;
  to: number;
  /** Where it came from, once it's in. */
  /** `file`: a trim's mp3, or the stream read's raw mp3 (decoded whole when stitching). */
  got?: { kind: "trim"; file: string; asked: DownloadRange } | { kind: "stream"; file: string };
}

/**
 * The stretch to ask for on try `attempt`. The provider caches a finished
 * job per request (a dead server's link included), so each retry asks for a
 * slightly different one: an earlier start (the stitch skips the extra), or
 * a later end where the start can't move.
 */
function askFor(chunk: Chunk, duration: number, attempt: number): DownloadRange {
  const last = Math.floor(duration);
  const end = Math.min(last, Math.ceil(chunk.to) + TAIL_SECONDS);
  if (chunk.from - attempt >= 0) return { start: chunk.from - attempt, end };
  return { start: chunk.from, end: Math.min(last, end + attempt) };
}

/** A watchdog for a download: aborts when no byte comes within FIRST_BYTE_MS, or none for STALL_MS. */
function watchdog(signal: AbortSignal) {
  const abort = new AbortController();
  const stop = () => abort.abort();
  signal.addEventListener("abort", stop, { once: true });
  const started = Date.now();
  let lastByte = 0;
  let why = "";
  const timer = setInterval(() => {
    const now = Date.now();
    if (!lastByte && now - started > FIRST_BYTE_MS) why = "no first byte";
    else if (lastByte && now - lastByte > STALL_MS) why = "stalled";
    if (why) abort.abort();
  }, 2_000);
  return {
    signal: abort.signal,
    tick: () => (lastByte = Date.now()),
    why: () => why,
    done: () => {
      clearInterval(timer);
      signal.removeEventListener("abort", stop);
      abort.abort();
    },
  };
}

/** Downloads `url` to `file` (a trimmed stretch: a finished file with a Content-Length). */
async function download(url: string, file: string, signal: AbortSignal): Promise<number> {
  const dog = watchdog(signal);
  try {
    const response = await fetch(url, { headers: UPSTREAM_HEADERS, signal: dog.signal });
    if (!response.ok || !response.body) throw new Error(`audio download returned ${response.status}`);
    const expected = Number(response.headers.get("content-length") ?? 0);
    let bytes = 0;
    const counted = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>).on(
      "data",
      (chunk: Buffer) => {
        bytes += chunk.byteLength;
        dog.tick();
      }
    );
    await pipeline(counted, createWriteStream(file));
    if (expected && bytes !== expected) throw new Error(`audio download cut off at ${bytes} of ${expected} bytes`);
    return bytes;
  } catch (error) {
    if (dog.why()) throw new Error(`audio download ${dog.why()}`);
    throw error;
  } finally {
    dog.done();
  }
}

const decodeArgs = (input: string) => [
  "-v", "error", "-nostdin", "-i", input, "-vn", "-f", "s16le", "-ac", "1", "-ar", String(AUDIO_SAMPLE_RATE), "pipe:1",
];

/** Raw 16 kHz mono s16le of `file`, as a stream (ffmpeg decodes). */
function decode(file: string) {
  const child = spawn("ffmpeg", decodeArgs(file), { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (data: Buffer) => (stderr = (stderr + data.toString()).slice(-2000)));
  return { child, stderr: () => stderr };
}

export async function runSourceJob({
  admin,
  job,
  dir,
  signal,
  progress,
}: {
  admin: SupabaseClient;
  job: SourceJob;
  dir: string;
  signal: AbortSignal;
  progress: (stage: ClipJobStage, value: number) => void;
}): Promise<{ path: string; bytes: number; seconds: number; timings: Record<string, number> }> {
  const { data: row } = await admin
    .from("clip_projects")
    .select("id, user_id, source_url, duration_seconds, status")
    .eq("id", job.project_id)
    .maybeSingle<{ id: string; user_id: string; source_url: string; duration_seconds: number; status: string }>();
  if (!row) throw new JobError("gone", "The project is gone.", false);
  if (row.status !== "queued") throw new JobError("not_waiting", `The project is ${row.status}, not waiting for audio.`, false);

  const duration = row.duration_seconds;
  const chunks: Chunk[] = [];
  for (let from = 0; from < duration; from += AUDIO_CHUNK_SECONDS) {
    chunks.push({ from, to: Math.min(duration, from + AUDIO_CHUNK_SECONDS) });
  }
  const fields = { job: job.id, project: row.id };

  // 1. Every stretch from the stream or a trim, whichever is first.
  progress("fetching", 0);
  const fetchStarted = Date.now();
  const work = new AbortController();
  const stopWork = () => work.abort();
  signal.addEventListener("abort", stopWork, { once: true });
  const deadline = setTimeout(stopWork, fetchMaxMs(duration));
  let allIn: () => void = () => {};
  const everyChunkIn = new Promise<void>((resolve) => (allIn = resolve));
  const settle = () => {
    const done = chunks.filter((chunk) => chunk.got).length;
    progress("fetching", (done / chunks.length) * 0.85);
    if (done === chunks.length) {
      allIn();
      work.abort();
    }
  };

  // The stream, saved as it arrives (one file per read, so a new read never
  // touches what an earlier one delivered). A decoder alongside only measures
  // how far it has got: decoded from a pipe, mp3 comes out ~60ms early against
  // the video, so the stitch decodes the saved file instead, which lines up
  // (measured 2026-11-19, as WhisperX itself decoded the provider's mp3).
  let streamReached = 0;
  const readStream = async () => {
    for (let attempt = 0; !work.signal.aborted; attempt++) {
      streamReached = 0;
      const dog = watchdog(work.signal);
      const decoder = spawn("ffmpeg", decodeArgs("pipe:0"), { stdio: ["pipe", "pipe", "ignore"] });
      decoder.stdin.on("error", () => {});
      const streamMp3 = path.join(dir, `stream-${attempt}.mp3`);
      const out = createWriteStream(streamMp3);
      let pcmBytes = 0;
      decoder.stdout.on("data", (data: Buffer) => {
        pcmBytes += data.byteLength;
        streamReached = pcmBytes / BYTES_PER_SECOND;
        let changed = false;
        for (const chunk of chunks) {
          // A second's margin: the saved file trails the decoder by a write or two.
          if (!chunk.got && chunk.to <= streamReached - 1) {
            chunk.got = { kind: "stream", file: streamMp3 };
            changed = true;
          }
        }
        if (changed) settle();
      });
      decoder.stdout.resume();
      const decoded = once(decoder, "close");
      try {
        const { directUrl } = await fetchDownloadLink(row.source_url, "mp3", undefined, {
          signal: dog.signal,
          stallMs: LINK_STALL_MS,
        });
        const response = await fetch(directUrl, { headers: UPSTREAM_HEADERS, signal: dog.signal });
        if (!response.ok || !response.body) throw new Error(`audio stream returned ${response.status}`);
        for await (const data of Readable.fromWeb(
          response.body as import("node:stream/web").ReadableStream<Uint8Array>
        ) as AsyncIterable<Buffer>) {
          dog.tick();
          if (!out.write(data)) await once(out, "drain", { signal: dog.signal });
          // A decoder that died stops draining; the watchdog's abort ends the wait.
          if (!decoder.stdin.write(data)) await once(decoder.stdin, "drain", { signal: dog.signal });
        }
        decoder.stdin.end();
        out.end();
        await decoded;
        await finished(out);
        // A clean end short of the video is a stream cut off, not the whole thing.
        if (streamReached < duration - SHORT_SLACK_SECONDS) {
          throw new Error(`stream ended at ${Math.round(streamReached)}s of ${duration}s`);
        }
        // Whole video in: anything the decode fell just short of counts as in too.
        for (const chunk of chunks) {
          if (!chunk.got && chunk.to <= streamReached + SHORT_SLACK_SECONDS) chunk.got = { kind: "stream", file: streamMp3 };
        }
        settle();
        return;
      } catch (error) {
        // Everything the decoder counted was written to `out` first: let it
        // reach the disk (chunks marked from this read are read back from it).
        decoder.kill("SIGKILL");
        out.end();
        await finished(out).catch(() => {});
        if (work.signal.aborted && !dog.why()) return;
        log(
          "source.stream_retry",
          { ...fields, attempt, reached: Math.round(streamReached), error: dog.why() || (error instanceof Error ? error.message : String(error)) },
          "warn"
        );
        // Stretches this read already delivered stay in, read back from its
        // file; a file nothing came from is dropped (a long video's is ~300MB).
        if (!chunks.some((chunk) => chunk.got?.kind === "stream" && chunk.got.file === streamMp3)) {
          await rm(streamMp3, { force: true }).catch(() => {});
        }
      } finally {
        dog.done();
      }
      await sleep(retryPause(attempt), work.signal);
    }
  };

  /** One try at a stretch's trim; true once it's in (by this or the stream). */
  const tryTrim = async (chunk: Chunk, index: number, attempt: number): Promise<boolean> => {
    const asked = askFor(chunk, duration, attempt);
    const file = path.join(dir, `chunk-${index}-${attempt}.mp3`);
    try {
      const { directUrl } = await fetchDownloadLink(row.source_url, "mp3", undefined, {
        range: asked,
        signal: work.signal,
        stallMs: LINK_STALL_MS,
        timeoutMs: TRIM_LINK_TIMEOUT_MS,
      });
      if (chunk.got) return true;
      await download(directUrl, file, work.signal);
      const { duration: got } = await probeStreams(file);
      const wanted = Math.min(asked.end, duration) - asked.start;
      if (!(Math.abs(got - wanted) <= TRIM_LENGTH_TOLERANCE_SECONDS)) {
        throw new Error(`stretch came back ${got.toFixed(2)}s long, not ${wanted}s`);
      }
      if (!chunk.got) {
        chunk.got = { kind: "trim", file, asked };
        settle();
      }
      return true;
    } catch (error) {
      if (work.signal.aborted || chunk.got) return Boolean(chunk.got);
      if (error instanceof VideoProviderError && (error.code === "not_found" || error.code === "not_configured")) {
        throw new JobError("source_unavailable", error.message, false);
      }
      log("source.trim_retry", { ...fields, chunk: index, attempt, error: error instanceof Error ? error.message : String(error) }, "warn");
      await sleep(
        error instanceof VideoProviderError && error.code === "rate_limited" ? 5_000 * (attempt + 1) : retryPause(attempt),
        work.signal
      );
      return false;
    }
  };

  // Trims go after the stretches still missing, latest first (the stream
  // reaches the first one in ~1.5 minutes), each worker taking the one with
  // the fewest tries that nobody's on, so one stuck stretch never holds a slot.
  const tries = chunks.map(() => 0);
  const busy = new Set<number>();
  const pickTrim = (): number | null => {
    let best: number | null = null;
    for (let index = chunks.length - 1; index >= 0; index--) {
      if (chunks[index].got || busy.has(index)) continue;
      if (best === null || tries[index] < tries[best]) best = index;
    }
    return best;
  };
  const trims = Promise.all(
    Array.from({ length: Math.min(TRIM_CONCURRENCY, chunks.length) }, async () => {
      while (!work.signal.aborted) {
        const index = pickTrim();
        if (index === null) {
          // Everything left is being tried; check back shortly.
          if (chunks.every((chunk) => chunk.got)) return;
          await sleep(2_000, work.signal);
          continue;
        }
        busy.add(index);
        try {
          await tryTrim(chunks[index], index, tries[index]++);
        } finally {
          busy.delete(index);
        }
      }
    })
  );
  try {
    await Promise.race([everyChunkIn, Promise.all([readStream(), trims])]);
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener("abort", stopWork);
    work.abort();
  }
  await trims.catch(() => {});
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const missing = chunks.filter((chunk) => !chunk.got);
  if (missing.length) {
    throw new JobError(
      "audio_incomplete",
      `Couldn't get the audio from ${missing.map((chunk) => `${chunk.from}s`).join(", ")} (stream reached ${Math.round(streamReached)}s).`,
      true
    );
  }
  const fetchMs = Date.now() - fetchStarted;
  const fromStream = chunks.filter((chunk) => chunk.got?.kind === "stream").length;

  // 2. Stitch: each stretch's samples from its own start (skipping what an
  // earlier-starting trim added), padded with silence if it runs short, into
  // one Opus encode.
  progress("encoding", 0.86);
  const encodeStarted = Date.now();
  const out = path.join(dir, "transcribe-audio.ogg");
  const kbps = transcribeAudioKbps(duration);
  const encoder = spawn(
    "ffmpeg",
    [
      "-v", "error", "-y",
      "-f", "s16le", "-ar", String(AUDIO_SAMPLE_RATE), "-ac", "1", "-i", "pipe:0",
      "-c:a", "libopus", "-b:a", `${kbps}k`, "-vbr", "constrained", "-threads", "2",
      out,
    ],
    { stdio: ["pipe", "ignore", "pipe"] }
  );
  let encoderError = "";
  encoder.stderr.on("data", (data: Buffer) => (encoderError = (encoderError + data.toString()).slice(-2000)));
  encoder.stdin.on("error", () => {});
  const encoded = once(encoder, "close");
  const write = async (buffer: Buffer) => {
    // An encoder that exited never drains; its exit code is checked below.
    if (!encoder.stdin.write(buffer)) await Promise.race([once(encoder.stdin, "drain"), encoded]);
  };
  const pad = async (bytes: number) => {
    while (bytes > 0) {
      const zeros = Buffer.alloc(Math.min(bytes, BYTES_PER_SECOND * 10));
      bytes -= zeros.byteLength;
      await write(zeros);
    }
  };

  const opened = new Map<string, Awaited<ReturnType<typeof open>>>();
  try {
    for (const chunk of chunks) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      // Whole samples, even byte counts.
      let need = Math.round((chunk.to - chunk.from) * AUDIO_SAMPLE_RATE) * 2;
      const got = chunk.got!;
      if (got.kind === "stream") {
        let stream = opened.get(got.file);
        if (!stream) {
          const pcm = `${got.file}.pcm`;
          const { child, stderr } = decode(got.file);
          const exited = once(child, "close");
          await pipeline(child.stdout, createWriteStream(pcm));
          const [code] = (await exited) as [number | null];
          // A read cut off mid-frame decodes with a complaint; what came out is still good.
          if (code !== 0) log("source.stream_decode", { ...fields, code, stderr: stderr().slice(-300) }, "warn");
          opened.set(got.file, (stream = await open(pcm, "r")));
        }
        let position = Math.round(chunk.from * AUDIO_SAMPLE_RATE) * 2;
        const buffer = Buffer.alloc(BYTES_PER_SECOND * 10);
        while (need > 0) {
          const { bytesRead } = await stream.read(buffer, 0, Math.min(need, buffer.byteLength), position);
          if (!bytesRead) break;
          position += bytesRead;
          need -= bytesRead;
          await write(Buffer.from(buffer.subarray(0, bytesRead)));
        }
      } else {
        let skip = Math.round((chunk.from - got.asked.start) * AUDIO_SAMPLE_RATE) * 2;
        const { child, stderr } = decode(got.file);
        const closed = once(child, "close");
        for await (const data of child.stdout as AsyncIterable<Buffer>) {
          let piece = data;
          if (skip) {
            const dropped = Math.min(skip, piece.byteLength);
            skip -= dropped;
            piece = piece.subarray(dropped);
          }
          if (!piece.byteLength) continue;
          const take = piece.subarray(0, need);
          need -= take.byteLength;
          await write(take);
          if (!need) break;
        }
        child.kill("SIGKILL");
        const [code] = (await closed) as [number | null];
        if (need && code !== 0 && code !== null) throw new JobError("decode_failed", `Decoding the audio failed: ${stderr()}`, true);
      }
      if (need > 3 * BYTES_PER_SECOND) {
        log("source.chunk_short", { ...fields, from: chunk.from, kind: got.kind, missingSeconds: need / BYTES_PER_SECOND }, "warn");
      }
      // Silence keeps every later word at its true time.
      await pad(need);
    }
  } catch (error) {
    encoder.kill("SIGKILL");
    throw error;
  } finally {
    for (const handle of opened.values()) await handle.close();
  }
  encoder.stdin.end();
  const [encodeCode] = (await encoded) as [number | null];
  if (encodeCode !== 0) throw new JobError("encode_failed", `Encoding the audio failed: ${encoderError}`, true);
  const bytes = (await stat(out)).size;
  const encodeMs = Date.now() - encodeStarted;

  // 3. Into the bucket (50MB cap; the bitrate is sized for it).
  progress("uploading", 0.95);
  const uploadStarted = Date.now();
  const storagePath = transcribeAudioPath(row);
  const { error } = await admin.storage
    .from(TRANSCRIBE_AUDIO_BUCKET)
    .upload(storagePath, await readFile(out), { contentType: "application/octet-stream", upsert: true });
  if (error) throw new JobError("upload_failed", `Storing the audio failed: ${error.message}`, true);

  return {
    path: storagePath,
    bytes,
    seconds: duration,
    timings: {
      fetchMs,
      encodeMs,
      uploadMs: Date.now() - uploadStarted,
      chunks: chunks.length,
      fromStream,
      kbps,
    },
  };
}
