import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClipJobStage } from "@/lib/clip-jobs";
import { WORKER_CUT_LIVE_MS } from "@/lib/server/clips/jobs";
import { precutClipSources, type StoredClipMoment } from "@/lib/server/clips/precut";
import type { ClipProjectRow } from "@/lib/server/clips/projects";
import { JobError } from "./render";

// A project's clips cut and stored where the editor loads them (precut.ts's
// layout and `cut` states, so nothing else changes). Clips near the start
// come from one read of the stream, the rest from trimmed downloads of their
// own. On Vercel this stops ~260s in; here it runs until every clip is cut.

/**
 * The longest one read may take. The provider can't seek and some of its
 * servers stream at only ~1.5x realtime (a 1:52:52 video, 2026-11-19), so a
 * clip near the end of a 2-hour video is ~70 minutes of reading away.
 */
const PREPARE_MAX_MS = 150 * 60_000;

export interface PrepareJob {
  id: string;
  project_id: string;
  input: { clipIds?: string[] };
}

type ProjectRow = Pick<ClipProjectRow, "id" | "user_id" | "source_url" | "duration_seconds" | "media_url" | "status"> & {
  clips: StoredClipMoment[] | null;
};

export async function runPrepareJob({
  admin,
  job,
  signal,
  progress,
}: {
  admin: SupabaseClient;
  job: PrepareJob;
  signal: AbortSignal;
  progress: (stage: ClipJobStage, value: number) => void;
}): Promise<{ stored: number; failed: number; readMs: number }> {
  const { data: row } = await admin
    .from("clip_projects")
    .select("id, user_id, source_url, duration_seconds, media_url, status, clips")
    .eq("id", job.project_id)
    .maybeSingle<ProjectRow>();
  if (!row || row.status !== "ready" || !row.clips) throw new JobError("fatal", "The video is gone or not ready.", false);

  // Only what still needs it: a clip cut since this was queued is left alone.
  const wanted = new Set(job.input.clipIds ?? row.clips.map((clip) => clip.id));
  const only = new Set(row.clips.filter((clip) => wanted.has(clip.id) && clip.cut?.state !== "stored").map((c) => c.id));
  if (!only.size) return { stored: 0, failed: 0, readMs: 0 };
  progress("fetching", 0);
  const started = Date.now();
  await precutClipSources(row, started + PREPARE_MAX_MS, {
    only,
    signal,
    liveForMs: WORKER_CUT_LIVE_MS,
    onProgress: (fraction) => progress("fetching", Math.min(0.99, fraction)),
  });
  const readMs = Date.now() - started;
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  const { data: after } = await admin
    .from("clip_projects")
    .select("clips")
    .eq("id", job.project_id)
    .maybeSingle<{ clips: StoredClipMoment[] | null }>();
  const states = (after?.clips ?? []).filter((clip) => only.has(clip.id)).map((clip) => clip.cut?.state);
  return {
    stored: states.filter((state) => state === "stored").length,
    failed: states.filter((state) => state !== "stored").length,
    readMs,
  };
}
