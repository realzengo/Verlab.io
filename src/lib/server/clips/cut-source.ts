import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { VideoProviderError, fetchDownloadLink, type DownloadRange } from "@/lib/server/video-provider";
import type { ClipProjectRow } from "@/lib/server/clips/projects";
import { Fmp4CutError, cutFragmentedMp4Ranges, type CutEvent, type CutRange } from "@/lib/server/clips/fmp4-cut";

// Opening the source video for cutting, shared by the editor's on-demand
// cuts (POST /api/clips/[id]/segments) and the server's pre-cut (precut.ts).
// Clips near the start come out of one read of the provider's stream; clips
// further in each get a trimmed download of their own (cutTrimmedRanges).

/**
 * The provider's stream has no Range support, so cutting a clip means
 * reading the video from the start up to it, at ~2-10 MB/s depending on the
 * provider's server. 1080p is ~2x the bytes of 720p, so only short videos get
 * it; longer ones stay at 720p to keep deep clips inside the cut route's
 * time limit.
 */
export const mediaFormatFor = (durationSeconds: number) => (durationSeconds <= 12 * 60 ? "1080" : "720");

/** A fresh provider link for the source video, saved on the row. */
export async function refreshClipMediaUrl(
  row: Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds">
): Promise<string> {
  const { directUrl } = await fetchDownloadLink(row.source_url, mediaFormatFor(row.duration_seconds));
  await createAdminClient().from("clip_projects").update({ media_url: directUrl }).eq("id", row.id);
  return directUrl;
}

// The keyframe a clip decodes from sits before its first frame.
const LEAD_SECONDS = 1;
const TAIL_SECONDS = 0.5;

// Same browser-like UA the downloads proxy sends; the provider rejects bare fetches.
export const UPSTREAM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

/** The source range to read for a clip range: a little lead and tail around it. */
export const paddedCutRange = (range: CutRange): CutRange => ({
  start: Math.max(0, range.start - LEAD_SECONDS),
  end: range.end + TAIL_SECONDS,
});

/** A fresh provider link's stream, skipping the saved one. */
async function openFreshClipSource(
  row: Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds">,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const fresh = await refreshClipMediaUrl(row);
  const response = await fetch(fresh, { headers: UPSTREAM_HEADERS, signal });
  if (!response.ok || !response.body) {
    throw new Error(`Source stream returned ${response.status}`);
  }
  return response.body;
}

/**
 * Cuts `ranges` out of an opened source (see openClipSource). Now and then
 * the provider serves a stream with no audio track (its merge of YouTube's
 * separate audio and video failed), which would cut into silent clips; that
 * stream is dropped before anything is cut and a fresh link is read instead.
 * Should that one come silent too, the cut goes ahead: the editor checks each
 * cut's sound and fills a missing one from the project's mp3
 * (GET /api/clips/[id]/audio). A stream that ends before a range does fails
 * that range ("failed" event) instead of passing a truncated cut as whole.
 */
export async function cutClipSource(
  row: Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds">,
  source: ReadableStream<Uint8Array>,
  ranges: CutRange[],
  onEvent: (event: CutEvent) => void | Promise<void>,
  signal: AbortSignal
): Promise<void> {
  const sourceDuration = row.duration_seconds > 0 ? row.duration_seconds : undefined;
  try {
    await cutFragmentedMp4Ranges(source, ranges, onEvent, { requireAudio: true, sourceDuration });
  } catch (error) {
    if (!(error instanceof Fmp4CutError && error.code === "no_audio") || signal.aborted) throw error;
    console.warn(`[clips] source of ${row.id} came without audio; reading a fresh link`);
    await cutFragmentedMp4Ranges(await openFreshClipSource(row, signal), ranges, onEvent, { sourceDuration });
  }
}

/**
 * The source video's stream, minting a fresh provider link if the saved one
 * has expired. `fresh` skips the saved link: a retry after a cut-off read
 * lands on a new link (often another of the provider's servers).
 */
export async function openClipSource(
  row: Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds" | "media_url">,
  signal: AbortSignal,
  { fresh = false }: { fresh?: boolean } = {}
): Promise<ReadableStream<Uint8Array>> {
  if (row.media_url && !fresh) {
    const response = await fetch(row.media_url, { headers: UPSTREAM_HEADERS, signal }).catch(() => null);
    if (response?.ok && response.body) return response.body;
    await response?.body?.cancel().catch(() => {});
  }
  // Provider links are short-lived; mint a new one and try once more.
  return openFreshClipSource(row, signal);
}

/* ── Trimmed downloads: one per clip, wherever it sits in the video ──── */

// Why trims (TRIM_AFTER_SECONDS, lib/clips.ts): the provider's stream can't
// seek and some of its servers send it at ~1.5x realtime, so a clip an hour
// in is 40+ minutes of reading away; a trimmed download of it takes a minute
// or two (measured 2026-11-19: 60s of 720p from 50 to 117 minutes into a
// 2:46:33 video, 78-104s each, four at once).
export { TRIM_AFTER_SECONDS } from "@/lib/clips";

const TRIM_ATTEMPTS = 3;
/** Trimmed downloads under way at once, per caller. */
const TRIM_CONCURRENCY = 6;
// Some of the provider's servers don't resolve, take 20s+ to send a byte,
// stall, or crawl (7 KB/s: 4s of 720p in two minutes). Those are given up
// for a new link (usually another server) while tries remain.
const TRIM_FIRST_BYTE_MS = 60_000;
/** A trim job whose progress doesn't move for this long is given up (the same stretch asked again usually goes through). */
const TRIM_LINK_STALL_MS = 45_000;
/** A trimmed video's link is usually there in ~16s. */
const TRIM_LINK_TIMEOUT_MS = 2 * 60_000;
const TRIM_STALL_MS = 30_000;
const TRIM_SPEED_GRACE_MS = 45_000;
/** Seconds of video per second of download, below which a try is dropped (not the last one). */
const TRIM_MIN_SPEED = 0.3;
const TRIM_WATCH_MS = 2_000;
/** Seconds of video past the range's end in each trim (its stream must end after the range does). */
const TRIM_TAIL_SECONDS = 2;
const RATE_LIMIT_PAUSE_MS = 5_000;

class TrimAbandoned extends Error {}

/**
 * The stretch to ask the provider for, on try `attempt`. A finished job is
 * cached per request, dead server and all, so each try asks for a slightly
 * different stretch: later end, or earlier start when the end is the
 * video's own.
 */
function trimFor(range: CutRange, duration: number, attempt: number): DownloadRange {
  const start = Math.max(0, Math.floor(range.start));
  const wantedEnd = Math.ceil(range.end) + TRIM_TAIL_SECONDS + attempt;
  if (!(duration > 0) || wantedEnd <= Math.floor(duration)) return { start, end: wantedEnd };
  return { start: Math.max(0, start - attempt), end: Math.floor(duration) };
}

/**
 * Cuts each of `ranges` (source seconds, padded) out of a trimmed download
 * of its own, a few at a time. Events carry the range's index and source
 * times, like cutClipSource's, but a cut is handed over only once it's
 * complete (start, its data, end, back to back), so a try that breaks
 * halfway is dropped and retried without the caller ever seeing it. A range
 * that runs out of tries gets a "failed" event. `onRangeProgress` reports
 * each range's download (0..1). Resolves when every range has ended or
 * failed, or `signal` aborts.
 */
export async function cutTrimmedRanges(
  row: Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds">,
  ranges: CutRange[],
  onEvent: (event: Exclude<CutEvent, { type: "progress" }>) => void | Promise<void>,
  signal: AbortSignal,
  { onRangeProgress, concurrency = TRIM_CONCURRENCY }: { onRangeProgress?: (index: number, fraction: number) => void; concurrency?: number } = {}
): Promise<void> {
  const duration = row.duration_seconds;
  const format = mediaFormatFor(duration);

  const cutOnce = async (index: number, attempt: number, last: boolean): Promise<boolean> => {
    const range = ranges[index];
    const trim = trimFor(range, duration, attempt);
    const local: CutRange = { start: Math.max(0, range.start - trim.start), end: range.end - trim.start };
    const length = Math.max(0.1, local.end - local.start);

    const tryAbort = new AbortController();
    const stop = () => tryAbort.abort();
    signal.addEventListener("abort", stop, { once: true });
    let opened = 0;
    let firstByte = 0;
    let lastByte = 0;
    let reached = 0;
    let why = "";
    const watch = setInterval(() => {
      const now = Date.now();
      if (!opened) return;
      if (!firstByte && now - opened > TRIM_FIRST_BYTE_MS) why = "no first byte";
      else if (firstByte && now - lastByte > TRIM_STALL_MS) why = "stalled";
      else if (
        !last &&
        firstByte &&
        now - firstByte > TRIM_SPEED_GRACE_MS &&
        Math.max(0, reached - local.start) / ((now - firstByte) / 1000) < TRIM_MIN_SPEED
      ) {
        why = "too slow";
      }
      if (why) tryAbort.abort();
    }, TRIM_WATCH_MS);

    let offset = 0;
    let data: Uint8Array[] = [];
    // Set from the cut's callbacks, which control-flow narrowing can't see.
    let outcome = null as "end" | "failed" | null;
    let audio = 1;
    try {
      const { directUrl } = await fetchDownloadLink(row.source_url, format, undefined, {
        range: trim,
        signal: tryAbort.signal,
        stallMs: TRIM_LINK_STALL_MS,
        timeoutMs: TRIM_LINK_TIMEOUT_MS,
      });
      if (tryAbort.signal.aborted) return false;
      opened = Date.now();
      const response = await fetch(directUrl, { headers: UPSTREAM_HEADERS, signal: tryAbort.signal });
      if (!response.ok || !response.body) throw new Error(`Trimmed download returned ${response.status}`);
      const counted = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            lastByte = Date.now();
            if (!firstByte) firstByte = lastByte;
            controller.enqueue(chunk);
          },
        })
      );
      await cutFragmentedMp4Ranges(
        counted,
        [local],
        (event) => {
          if (event.type === "progress") {
            reached = event.time;
            onRangeProgress?.(index, Math.min(0.99, Math.max(0, (event.time - local.start) / length)));
          } else if (event.type === "start") offset = event.offset + trim.start;
          else if (event.type === "data") data.push(event.bytes);
          else if (event.type === "end") {
            outcome = "end";
            audio = event.audio;
          } else outcome = "failed";
        },
        // The last try takes a silent cut over none: the editor fills its sound from the project's mp3.
        { requireAudio: !last, sourceDuration: trim.end - trim.start }
      );
      if (outcome !== "end") throw new TrimAbandoned("the trimmed download ended before the clip did");
    } catch (error) {
      if (signal.aborted) return false;
      const reason = why || (error instanceof Error ? error.message : String(error));
      console.warn(`[clips/trim] ${row.id} range ${index} try ${attempt + 1}/${TRIM_ATTEMPTS}: ${reason}`);
      if (error instanceof VideoProviderError && error.code === "rate_limited") {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_PAUSE_MS));
      }
      // A video the provider says is gone won't come back on another try.
      if (error instanceof VideoProviderError && (error.code === "not_found" || error.code === "not_configured")) {
        throw error;
      }
      return false;
    } finally {
      clearInterval(watch);
      signal.removeEventListener("abort", stop);
      tryAbort.abort();
    }

    if (audio < 0.8) console.warn(`[clips/trim] ${row.id} range ${index}: ${Math.round(audio * 100)}% of it has sound`);
    onRangeProgress?.(index, 1);
    await onEvent({ type: "start", index, offset });
    for (const bytes of data) await onEvent({ type: "data", index, bytes });
    data = [];
    await onEvent({ type: "end", index, audio });
    return true;
  };

  const cutOne = async (index: number) => {
    for (let attempt = 0; attempt < TRIM_ATTEMPTS && !signal.aborted; attempt++) {
      try {
        if (await cutOnce(index, attempt, attempt === TRIM_ATTEMPTS - 1)) return;
      } catch (error) {
        console.error(`[clips/trim] ${row.id} range ${index}:`, error);
        break;
      }
    }
    if (!signal.aborted) await onEvent({ type: "failed", index, reason: "truncated" });
  };

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, ranges.length) }, async () => {
      while (next < ranges.length && !signal.aborted) await cutOne(next++);
    })
  );
}
