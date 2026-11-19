import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TRIM_AFTER_SECONDS,
  cutClipSource,
  cutTrimmedRanges,
  openClipSource,
  paddedCutRange,
} from "@/lib/server/clips/cut-source";
import { clipSourceRange, type ClipMoment } from "@/lib/clips";
import type { ClipProjectRow } from "@/lib/server/clips/projects";

// The moment a project is ready, the server cuts every clip's stretch of the
// source and stores the cuts (clips near the start from one read of the
// stream, the rest from trimmed downloads of their own, all at once), so the editor loads them from
// Storage when the user presses Create instead of reading the video then
// (the provider's stream can't seek: reaching a clip 40 minutes in means
// reading the 40 minutes before it, a minute or two of waiting). The user is
// still choosing clips while this runs, and coming back to the project later
// costs no read at all.
//
// Cuts sit next to the project's exports, <user>/<project>/source-<clip>-<n>.mp4,
// so deleting the project or the account removes them too, and
// /api/cron/clip-sources-cleanup drops them after a week. A cut over the
// bucket's 50MB cap is stored in parts that concatenate back into it (an
// fMP4 splits cleanly between boxes). Each clip's state lives on the clip in
// clip_projects.clips (`cut`); /api/clips/[id]/sources reads it.

export const CLIP_SOURCES_BUCKET = "clip-exports";
const PART_BYTES = 40 * 1024 * 1024;
const PROGRESS_EVERY_MS = 8_000;
/** A pre-cut never runs longer than the 300s function it rides on. */
export const PRECUT_MAX_MS = 300_000;
// Reads of the source per pre-cut: the first, then fresh links for clips a cut-off read missed.
const PRECUT_READS = 3;
// Another read only starts with this much of the deadline left.
const RETRY_MIN_MS = 30_000;

/** Where a clip's stored cut stands. */
export type ClipCutState =
  /** `until`: how long "cutting" holds without news (a worker's read renews it); else PRECUT_MAX_MS from startedAt. */
  | { state: "cutting"; startedAt: string; reached: number; until?: string }
  | { state: "stored"; from: number; to: number; offset: number; parts: number }
  | { state: "failed" };

export type StoredClipMoment = ClipMoment & { cut?: ClipCutState };

/** A clip as the app sees it, without the server's cut state. */
export function withoutCut(clip: StoredClipMoment): ClipMoment {
  const copy = { ...clip };
  delete copy.cut;
  return copy;
}

export const clipSourcePath = (row: Pick<ClipProjectRow, "id" | "user_id">, clipId: string, part: number) =>
  `${row.user_id}/${row.id}/source-${clipId}-${part}.mp4`;

export const isClipSourcePath = (name: string) => name.startsWith("source-");

/** Whether a clip's "cutting" state is still live (someone is reading towards it). */
export function cutStillLive(cut: Extract<ClipCutState, { state: "cutting" }>, now = Date.now()): boolean {
  return now < (cut.until ? Date.parse(cut.until) : Date.parse(cut.startedAt) + PRECUT_MAX_MS);
}

export interface PrecutOptions {
  /** Cut only these clips; the others keep their state. Default: every clip. */
  only?: Set<string>;
  /** Stops the reads early (the render worker's job was canceled, or it's shutting down). */
  signal?: AbortSignal;
  /** How far the cutting has got over all the clips (0..1). */
  onProgress?: (fraction: number) => void;
  /**
   * Mark clips "cutting" for this long, renewed as the read goes (the render
   * worker, whose reads run far past PRECUT_MAX_MS). If it dies, the clips
   * lapse within this and the editor cuts them itself.
   */
  liveForMs?: number;
}

/**
 * Cuts and stores every clip of a project that just became ready, reading
 * until `deadline` (epoch ms, inside the function's own time limit). Clips
 * it doesn't reach are marked failed and the editor cuts them itself. The
 * render worker runs this too, with no function limit (see PrecutOptions).
 */
export async function precutClipSources(
  row: Pick<ClipProjectRow, "id" | "user_id" | "source_url" | "duration_seconds" | "media_url"> & {
    clips: StoredClipMoment[] | null;
  },
  deadline: number,
  options: PrecutOptions = {}
): Promise<void> {
  const admin = createAdminClient();
  const storage = admin.storage.from(CLIP_SOURCES_BUCKET);
  const clips: StoredClipMoment[] = (row.clips ?? []).map((clip) => ({ ...clip }));
  if (!clips.length || deadline - Date.now() < 20_000) return;

  // Every write sends the latest state, one at a time, so they can't land out of order.
  let saving = Promise.resolve();
  const save = () => {
    saving = saving.then(async () => {
      const { error } = await admin.from("clip_projects").update({ clips }).eq("id", row.id).eq("status", "ready");
      if (error) console.error("[clips/precut] saving cut state failed:", error);
    });
    return saving;
  };

  const startedAt = new Date().toISOString();
  const targets = clips.map((_, index) => index).filter((index) => !options.only || options.only.has(clips[index].id));
  if (!targets.length) return;
  const until = () => (options.liveForMs ? new Date(Date.now() + options.liveForMs).toISOString() : undefined);
  for (const index of targets) clips[index].cut = { state: "cutting", startedAt, reached: 0, until: until() };
  await save();

  const ranges = clips.map((clip) => clipSourceRange(clip, row.duration_seconds));
  const chunks: Uint8Array[][] = clips.map(() => []);
  const offsets = clips.map(() => 0);
  const finished: Promise<void>[] = [];
  // Clips whose read broke (the stream ended or errored before them); worth another read.
  const broken = new Set<number>();
  // How far each clip's cut has got (0..1), for options.onProgress.
  const done = clips.map(() => 0);
  let lastReport = Date.now();
  /** Progress news, at most every PROGRESS_EVERY_MS: renews the "cutting" hold and saves how far each clip got. */
  const report = () => {
    if (Date.now() - lastReport < PROGRESS_EVERY_MS) return;
    lastReport = Date.now();
    const renewed = until();
    if (renewed) {
      for (const index of targets) {
        const cut = clips[index].cut;
        if (cut?.state === "cutting") cut.until = renewed;
      }
    }
    options.onProgress?.(targets.reduce((sum, index) => sum + done[index], 0) / targets.length);
    void save();
  };

  /** Uploads a finished cut (in parts under the bucket's cap) and records it. */
  const store = async (index: number) => {
    const groups: Uint8Array[][] = [[]];
    let size = 0;
    for (const chunk of chunks[index]) {
      if (size && size + chunk.byteLength > PART_BYTES) {
        groups.push([]);
        size = 0;
      }
      groups[groups.length - 1].push(chunk);
      size += chunk.byteLength;
    }
    chunks[index] = [];
    try {
      await Promise.all(
        groups.map(async (group, part) => {
          const body = new Blob(group as BlobPart[], { type: "video/mp4" });
          const { error } = await storage.upload(clipSourcePath(row, clips[index].id, part), body, {
            contentType: "video/mp4",
            upsert: true,
          });
          if (error) throw error;
        })
      );
      clips[index].cut = { ...ranges[index], state: "stored", offset: offsets[index], parts: groups.length };
      done[index] = 1;
    } catch (error) {
      console.error(`[clips/precut] storing ${clips[index].id} failed:`, error);
      clips[index].cut = { state: "failed" };
    }
    await save();
  };

  /** One read of the source for the clips at `indices`; true if it ran out of time. */
  const read = async (indices: number[], fresh: boolean): Promise<boolean> => {
    const upstream = new AbortController();
    const timer = setTimeout(() => upstream.abort(), Math.max(0, deadline - Date.now()));
    const stop = () => upstream.abort();
    options.signal?.addEventListener("abort", stop, { once: true });
    // Cut in full this read (storing may still be under way): never read again.
    const ended = new Set<number>();
    try {
      const source = await openClipSource(row, upstream.signal, { fresh });
      await cutClipSource(
        row,
        source,
        indices.map((index) => paddedCutRange({ start: ranges[index].from, end: ranges[index].to })),
        (event) => {
          if (event.type === "progress") {
            for (const index of indices) {
              const cut = clips[index].cut;
              if (cut?.state === "cutting") cut.reached = event.time;
              done[index] = Math.min(1, event.time / Math.max(1, ranges[index].to));
            }
            report();
            return;
          }
          const index = indices[event.index];
          if (event.type === "start") {
            offsets[index] = event.offset;
          } else if (event.type === "data") {
            chunks[index].push(event.bytes);
          } else if (event.type === "failed") {
            // The stream ended before this clip did: never store a truncated cut.
            console.warn(`[clips/precut] ${clips[index].id} of ${row.id}: stream ended early`);
            chunks[index] = [];
            broken.add(index);
          } else {
            if (event.audio < 0.8) {
              // Stored anyway; the editor fills the missing sound from the project's mp3.
              console.warn(
                `[clips/precut] ${clips[index].id} of ${row.id}: ${Math.round(event.audio * 100)}% of it has sound`
              );
            }
            ended.add(index);
            finished.push(store(index));
          }
        },
        upstream.signal
      );
      return false;
    } catch (error) {
      const outOfTime = upstream.signal.aborted;
      console.error("[clips/precut] read failed:", outOfTime ? "out of time" : error);
      if (!outOfTime) for (const index of indices) if (!ended.has(index)) broken.add(index);
      return outOfTime;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", stop);
      upstream.abort();
    }
  };

  // A read the provider cut off (or broke) is tried again on a fresh link
  // while there's time; one that simply ran out of time isn't.
  const readNear = async (near: number[]) => {
    let indices = near;
    for (let attempt = 0; attempt < PRECUT_READS && indices.length; attempt++) {
      if (attempt > 0 && (deadline - Date.now() < RETRY_MIN_MS || options.signal?.aborted)) break;
      broken.clear();
      for (const index of indices) {
        chunks[index] = [];
        clips[index].cut = { state: "cutting", startedAt, reached: 0, until: until() };
      }
      const outOfTime = await read(indices, attempt > 0);
      if (outOfTime) break;
      indices = indices.filter((index) => broken.has(index));
      if (indices.length) console.warn(`[clips/precut] ${row.id}: reading ${indices.length} clip(s) again`);
    }
  };

  /** Clips further in, each from a trimmed download of its own (retried inside on fresh links). */
  const cutDeep = async (deep: number[]) => {
    if (!deep.length) return;
    const upstream = new AbortController();
    const timer = setTimeout(() => upstream.abort(), Math.max(0, deadline - Date.now()));
    const stop = () => upstream.abort();
    options.signal?.addEventListener("abort", stop, { once: true });
    try {
      await cutTrimmedRanges(
        row,
        deep.map((index) => paddedCutRange({ start: ranges[index].from, end: ranges[index].to })),
        (event) => {
          const index = deep[event.index];
          if (event.type === "start") {
            offsets[index] = event.offset;
          } else if (event.type === "data") {
            chunks[index].push(event.bytes);
          } else if (event.type === "end") {
            finished.push(store(index));
          } else {
            console.warn(`[clips/precut] ${clips[index].id} of ${row.id}: no trimmed download came through`);
            chunks[index] = [];
          }
        },
        upstream.signal,
        {
          onRangeProgress: (position, fraction) => {
            const index = deep[position];
            const cut = clips[index].cut;
            // The editor shows `reached` against the clip's start, so this fills its bar as the trim arrives.
            if (cut?.state === "cutting") cut.reached = ranges[index].from * fraction;
            done[index] = fraction;
            report();
          },
        }
      );
    } catch (error) {
      console.error("[clips/precut] trimmed cuts failed:", upstream.signal.aborted ? "out of time" : error);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", stop);
      upstream.abort();
    }
  };

  await Promise.all([
    readNear(targets.filter((index) => ranges[index].from < TRIM_AFTER_SECONDS)),
    cutDeep(targets.filter((index) => ranges[index].from >= TRIM_AFTER_SECONDS)),
  ]);
  await Promise.all(finished);
  // Whatever the reads didn't reach: the editor cuts these itself.
  for (const index of targets) if (clips[index].cut?.state === "cutting") clips[index].cut = { state: "failed" };
  await save();
}

const KEEP_SOURCES_DAYS = 7;
const CLEANUP_BATCH = 100;

/** Drops stored cuts a week after they were made; opening the project later cuts again. */
export async function removeExpiredClipSources(): Promise<number> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - KEEP_SOURCES_DAYS * 86_400_000).toISOString();
  const { data: rows, error } = await admin
    .from("clip_projects")
    .select("id, user_id, clips")
    .eq("status", "ready")
    .lt("updated_at", cutoff)
    .filter("clips", "cs", JSON.stringify([{ cut: { state: "stored" } }]))
    .limit(CLEANUP_BATCH)
    .returns<{ id: string; user_id: string; clips: StoredClipMoment[] }[]>();
  if (error) throw error;

  const storage = admin.storage.from(CLIP_SOURCES_BUCKET);
  for (const row of rows ?? []) {
    const folder = `${row.user_id}/${row.id}`;
    const { data: files, error: listError } = await storage.list(folder);
    if (listError) {
      console.error(`[clips/precut] listing ${folder} failed:`, listError);
      continue;
    }
    const paths = (files ?? []).filter((file) => isClipSourcePath(file.name)).map((file) => `${folder}/${file.name}`);
    if (paths.length) {
      const { error: removeError } = await storage.remove(paths);
      if (removeError) {
        console.error(`[clips/precut] removing ${folder} sources failed:`, removeError);
        continue;
      }
    }
    await admin
      .from("clip_projects")
      .update({ clips: row.clips.map(withoutCut) })
      .eq("id", row.id);
  }
  return rows?.length ?? 0;
}
