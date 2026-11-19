import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LIVE_RENDER_STATUSES,
  RENDERER_VERSION,
  stableStringify,
  type ClipJobStage,
  type ClipJobStatus,
  type ClipRenderInput,
  type ClipRenderJob,
  type ClipRenderRequest,
} from "@/lib/clip-jobs";
import type { ClipMoment } from "@/lib/clips";
import type { StoredClipMoment } from "@/lib/server/clips/precut";
import { isAdminEmail } from "@/lib/server/admin";
import {
  CLIP_EXPORT_COLUMNS,
  withClipExportUrls,
  type ClipExportRow,
} from "@/lib/server/clips/exports";

// Server renders (clip_jobs, kind 'render'), queued here and done by the
// render worker on Railway (worker/). Exports are free; the queue's job is
// to not waste the worker: the same clip with the same settings is rendered
// once (dedupe_key), and new settings for a clip cancel its older render.

/** A worker that checked in within this long counts as up. */
const WORKER_FRESH_MS = 60_000;
/** Settings bigger than this aren't a clip's settings. */
const MAX_SETTINGS_BYTES = 64 * 1024;

export interface ClipJobRow {
  id: string;
  user_id: string;
  project_id: string;
  clip_id: string | null;
  kind: "source" | "prepare" | "render";
  status: ClipJobStatus;
  stage: ClipJobStage | null;
  progress: number;
  input: ClipRenderInput;
  dedupe_key: string;
  attempts: number;
  max_attempts: number;
  export_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
}

const JOB_COLUMNS =
  "id, user_id, project_id, clip_id, kind, status, stage, progress, input, dedupe_key, attempts, max_attempts, export_id, error_code, error_message, created_at, finished_at";

/**
 * Who renders on the server (CLIP_SERVER_RENDER): "1" everyone, "0" no one
 * (every export renders in the browser), unset (the rollout default) admins
 * only (ADMIN_EMAILS), so the worker proves itself in production first.
 */
export function serverRenderEnabledFor(email: string | null | undefined): boolean {
  const mode = process.env.CLIP_SERVER_RENDER;
  if (mode === "1") return true;
  if (mode === "0") return false;
  return isAdminEmail(email);
}

/** Whether any render worker has checked in recently. */
export async function workerOnline(admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin
    .from("clip_workers")
    .select("last_seen")
    .order("last_seen", { ascending: false })
    .limit(1)
    .maybeSingle<{ last_seen: string }>();
  return Boolean(data && Date.now() - Date.parse(data.last_seen) < WORKER_FRESH_MS);
}

/**
 * The render's identity: the same project, clip, settings, inputs, caption
 * words and renderer version give the same MP4, so they share a key.
 */
export function renderDedupeKey(projectId: string, clip: ClipMoment, input: ClipRenderInput): string {
  const hash = createHash("sha256")
    .update(
      stableStringify({
        v: RENDERER_VERSION,
        input,
        // What the captions draw from the moment itself.
        keywords: clip.keywords ?? [],
        emojis: clip.emojis ?? [],
      })
    )
    .digest("hex")
    .slice(0, 32);
  return `render:${projectId}:${clip.id}:${hash}`;
}

/** Checks one render request; returns its input, or why it's refused. */
export function readRenderRequest(
  request: ClipRenderRequest,
  { userId, projectId, clips }: { userId: string; projectId: string; clips: ClipMoment[] }
): { clip: ClipMoment; input: ClipRenderInput } | { error: string } {
  const clip = clips.find((c) => c.id === request.clipId);
  if (!clip) return { error: "Unknown clip" };
  const settings = request.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return { error: "Invalid settings" };
  if (JSON.stringify(settings).length > MAX_SETTINGS_BYTES) return { error: "Settings too large" };
  if (!(typeof settings.start === "number" && typeof settings.end === "number" && settings.end > settings.start)) {
    return { error: "Invalid clip range" };
  }
  // Inputs must be this project's own uploads, never another user's files.
  const inputs = `${userId}/${projectId}/inputs/`;
  for (const path of [request.trackPath, request.backgroundPath]) {
    if (path != null && (typeof path !== "string" || !path.startsWith(inputs) || path.includes(".."))) {
      return { error: "Invalid input file" };
    }
  }
  return {
    clip,
    input: { settings, trackPath: request.trackPath ?? null, backgroundPath: request.backgroundPath ?? null },
  };
}

/**
 * Queues renders, one per clip. Asking again with identical settings returns
 * the live (or finished) job instead of a new one; different settings cancel
 * the clip's older render first.
 */
export async function enqueueRenders(
  admin: SupabaseClient,
  { userId, projectId, items }: { userId: string; projectId: string; items: { clip: ClipMoment; input: ClipRenderInput }[] }
): Promise<ClipJobRow[]> {
  const jobs: ClipJobRow[] = [];
  for (const { clip, input } of items) {
    const dedupeKey = renderDedupeKey(projectId, clip, input);

    // New settings for this clip: its older live renders are moot.
    await admin
      .from("clip_jobs")
      .update({ status: "canceled", finished_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("clip_id", clip.id)
      .eq("kind", "render")
      .in("status", LIVE_RENDER_STATUSES)
      .neq("dedupe_key", dedupeKey);

    const existing = await liveJob(admin, dedupeKey);
    // A finished render whose clip was deleted from the library since: render it again.
    if (existing?.status === "done" && !existing.export_id) {
      await admin.from("clip_jobs").update({ status: "canceled" }).eq("id", existing.id).eq("status", "done");
    } else if (existing) {
      jobs.push(existing);
      continue;
    }

    const { data, error } = await admin
      .from("clip_jobs")
      .insert({
        user_id: userId,
        project_id: projectId,
        clip_id: clip.id,
        kind: "render",
        input,
        dedupe_key: dedupeKey,
        stage: "waiting",
      })
      .select(JOB_COLUMNS)
      .single<ClipJobRow>();
    if (data) {
      jobs.push(data);
      continue;
    }
    // Two requests raced to create the same render: use the one that won.
    if (error?.code === "23505") {
      const winner = await liveJob(admin, dedupeKey);
      if (winner) {
        jobs.push(winner);
        continue;
      }
    }
    throw error ?? new Error("Could not queue the render");
  }
  return jobs;
}

async function liveJob(admin: SupabaseClient, dedupeKey: string): Promise<ClipJobRow | null> {
  const { data } = await admin
    .from("clip_jobs")
    .select(JOB_COLUMNS)
    .eq("dedupe_key", dedupeKey)
    .not("status", "in", "(failed,canceled)")
    .maybeSingle<ClipJobRow>();
  return data ?? null;
}

const FRIENDLY_ERRORS: Record<string, string> = {
  lease_expired: "The render server stopped responding. Try again.",
  no_audio: "This clip's sound didn't come through.",
  source: "We couldn't read this part of the video. Try again.",
  fatal: "This clip can't be rendered.",
};

/** Jobs as the app shows them: how many renders are ahead, and the saved clip when done. */
export async function toRenderJobs(admin: SupabaseClient, rows: ClipJobRow[]): Promise<ClipRenderJob[]> {
  const exportIds = rows.map((row) => row.export_id).filter((id): id is string => Boolean(id));
  const exportsById = new Map<string, Awaited<ReturnType<typeof withClipExportUrls>>[number]>();
  if (exportIds.length) {
    const { data } = await admin
      .from("clip_exports")
      .select(CLIP_EXPORT_COLUMNS)
      .in("id", exportIds)
      .returns<ClipExportRow[]>();
    for (const item of await withClipExportUrls(data ?? [])) exportsById.set(item.id, item);
  }

  // The whole queue's waiting renders (any user's), oldest first: a place in line.
  let queue: string[] = [];
  if (rows.some((row) => row.status === "queued")) {
    const { data } = await admin
      .from("clip_jobs")
      .select("created_at")
      .eq("kind", "render")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(500)
      .returns<{ created_at: string }[]>();
    queue = (data ?? []).map((row) => row.created_at);
  }
  const { count: running } = rows.some((row) => row.status === "queued")
    ? await admin.from("clip_jobs").select("id", { count: "exact", head: true }).eq("kind", "render").eq("status", "running")
    : { count: 0 };

  return rows.map((row) => {
    const saved = row.export_id ? exportsById.get(row.export_id) : undefined;
    return {
      id: row.id,
      projectId: row.project_id,
      clipId: row.clip_id ?? "",
      status: row.status,
      stage: row.stage,
      progress: Number(row.progress) || 0,
      ahead: row.status === "queued" ? (running ?? 0) + queue.filter((at) => at < row.created_at).length : 0,
      error:
        row.status === "failed"
          ? (FRIENDLY_ERRORS[row.error_code ?? ""] ?? row.error_message ?? "We couldn't render this clip.")
          : null,
      export: saved
        ? {
            id: saved.id,
            url: saved.url,
            downloadUrl: saved.downloadUrl,
            sizeBytes: saved.sizeBytes,
            durationSeconds: saved.durationSeconds,
          }
        : null,
      settings: row.input.settings,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
    };
  });
}

/** Each clip's latest render in a project (or the user's live ones everywhere). */
export async function latestRenderJobs(
  admin: SupabaseClient,
  filter: { projectId: string; userId: string } | { userId: string; liveOnly: true }
): Promise<ClipJobRow[]> {
  let query = admin.from("clip_jobs").select(JOB_COLUMNS).eq("kind", "render").eq("user_id", filter.userId);
  if ("projectId" in filter) query = query.eq("project_id", filter.projectId).neq("status", "canceled");
  else query = query.in("status", LIVE_RENDER_STATUSES);
  const { data } = await query.order("created_at", { ascending: false }).limit(200).returns<ClipJobRow[]>();
  const latest = new Map<string, ClipJobRow>();
  for (const row of data ?? []) {
    const key = `${row.project_id}:${row.clip_id}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()];
}

/* ── Cutting clips on the worker (kind 'prepare') ────────────────────── */

/** A worker's read marks clips "cutting" for this long, renewed as it goes (see precut.ts). */
export const WORKER_CUT_LIVE_MS = 3 * 60_000;
/** After a cut job ends, the project's leftovers (clips it couldn't cut) wait this long before another. */
const PREPARE_RETRY_MS = 10 * 60_000;

/** Whether the worker cuts this user's clips: the render rollout switch, and a worker up. */
export async function workerCutsFor(admin: SupabaseClient, email: string | null | undefined): Promise<boolean> {
  return serverRenderEnabledFor(email) && (await workerOnline(admin));
}

/** The project owner's email, for the rollout switch when there's no signed-in request. */
export async function ownerEmail(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

/**
 * Has the worker read the source once and cut `clipIds` into Storage, with
 * no time limit (on Vercel a cut stops ~260s into the stream, so clips deep
 * in a long video never got cut). Marks those clips "cutting" at once, so
 * the editor waits for the worker instead of starting its own cut. Returns
 * false when the project has a cut job already or just had one.
 */
export async function enqueuePrepare(
  admin: SupabaseClient,
  { userId, projectId, clipIds }: { userId: string; projectId: string; clipIds: string[] }
): Promise<boolean> {
  if (!clipIds.length) return false;
  const { data: previous } = await admin
    .from("clip_jobs")
    .select("status, finished_at")
    .eq("project_id", projectId)
    .eq("kind", "prepare")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<{ status: ClipJobStatus; finished_at: string | null }[]>();
  const latest = previous?.[0];
  if (latest && (latest.status === "queued" || latest.status === "running")) return false;
  if (latest?.finished_at && Date.now() - Date.parse(latest.finished_at) < PREPARE_RETRY_MS) return false;

  const { error } = await admin.from("clip_jobs").insert({
    user_id: userId,
    project_id: projectId,
    kind: "prepare",
    input: { clipIds },
    // Two requests racing to queue the same next cut collide here.
    dedupe_key: `prepare:${projectId}:${previous?.length ?? 0}`,
    stage: "waiting",
  });
  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }

  // Waiting for the worker, as far as the editor can tell.
  const { data: row } = await admin
    .from("clip_projects")
    .select("clips")
    .eq("id", projectId)
    .eq("status", "ready")
    .maybeSingle<{ clips: StoredClipMoment[] | null }>();
  if (row?.clips) {
    const wanted = new Set(clipIds);
    const now = new Date();
    const clips = row.clips.map((clip) =>
      wanted.has(clip.id) && clip.cut?.state !== "stored"
        ? {
            ...clip,
            cut: {
              state: "cutting" as const,
              startedAt: now.toISOString(),
              reached: 0,
              until: new Date(now.getTime() + WORKER_CUT_LIVE_MS).toISOString(),
            },
          }
        : clip
    );
    await admin.from("clip_projects").update({ clips }).eq("id", projectId).eq("status", "ready");
  }
  return true;
}
