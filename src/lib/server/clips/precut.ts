import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { cutClipSource, openClipSource, paddedCutRange } from "@/lib/server/clips/cut-source";
import { clipSourceRange, type ClipMoment } from "@/lib/clips";
import type { ClipProjectRow } from "@/lib/server/clips/projects";

// The moment a project is ready, the server cuts every clip's stretch of the
// source in one read and stores the cuts, so the editor loads them from
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

/** Where a clip's stored cut stands. */
export type ClipCutState =
  | { state: "cutting"; startedAt: string; reached: number }
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

/**
 * Cuts and stores every clip of a project that just became ready, reading
 * until `deadline` (epoch ms, inside the function's own time limit). Clips
 * it doesn't reach are marked failed and the editor cuts them itself.
 */
export async function precutClipSources(
  row: Pick<ClipProjectRow, "id" | "user_id" | "source_url" | "duration_seconds" | "media_url"> & {
    clips: StoredClipMoment[] | null;
  },
  deadline: number
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
  for (const clip of clips) clip.cut = { state: "cutting", startedAt, reached: 0 };
  await save();

  const ranges = clips.map((clip) => clipSourceRange(clip, row.duration_seconds));
  const chunks: Uint8Array[][] = clips.map(() => []);
  const offsets = clips.map(() => 0);
  const finished: Promise<void>[] = [];

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
    } catch (error) {
      console.error(`[clips/precut] storing ${clips[index].id} failed:`, error);
      clips[index].cut = { state: "failed" };
    }
    await save();
  };

  const upstream = new AbortController();
  const timer = setTimeout(() => upstream.abort(), Math.max(0, deadline - Date.now()));
  let lastProgress = Date.now();
  try {
    const source = await openClipSource(row, upstream.signal);
    await cutClipSource(
      row,
      source,
      ranges.map((range) => paddedCutRange({ start: range.from, end: range.to })),
      (event) => {
        if (event.type === "start") {
          offsets[event.index] = event.offset;
        } else if (event.type === "data") {
          chunks[event.index].push(event.bytes);
        } else if (event.type === "end") {
          finished.push(store(event.index));
        } else if (Date.now() - lastProgress >= PROGRESS_EVERY_MS) {
          lastProgress = Date.now();
          for (const clip of clips) if (clip.cut?.state === "cutting") clip.cut.reached = event.time;
          void save();
        }
      },
      upstream.signal
    );
  } catch (error) {
    console.error("[clips/precut] read failed:", upstream.signal.aborted ? "out of time" : error);
  } finally {
    clearTimeout(timer);
    upstream.abort();
  }

  await Promise.all(finished);
  // Whatever the read didn't reach: the editor cuts these itself.
  for (const clip of clips) if (clip.cut?.state === "cutting") clip.cut = { state: "failed" };
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
