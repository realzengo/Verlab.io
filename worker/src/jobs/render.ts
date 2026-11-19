import { createWriteStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RenderBrowser } from "../browser";
import type { PageStage } from "../page-api";
import type { ClipJobStage, ClipRenderInput } from "@/lib/clip-jobs";
import { CLIP_EXPORT_MAX_BYTES, clipSourceRange, type ClipMoment, type TranscriptWord } from "@/lib/clips";
import { cutClipSource, openClipSource, paddedCutRange } from "@/lib/server/clips/cut-source";
import { CLIP_SOURCES_BUCKET, clipSourcePath, type StoredClipMoment } from "@/lib/server/clips/precut";
import type { ClipProjectRow } from "@/lib/server/clips/projects";

// One server render: the clip's cut of the source (the server's stored
// pre-cut, else a fresh read), the editor's face track and bottom video,
// the editor's own exportClip in headless Chrome, then the MP4 saved to the
// user's library. Everything it writes is keyed by the job, so a retry
// (another attempt, another worker) overwrites instead of duplicating.

export const BUCKET = "clip-exports";
const SOURCE_READS = 3;

/** A failure with a code the app understands; `retry` when another attempt could succeed. */
export class JobError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retry: boolean
  ) {
    super(message);
    this.name = "JobError";
  }
}

export interface RenderJob {
  id: string;
  user_id: string;
  project_id: string;
  clip_id: string;
  attempts: number;
  input: ClipRenderInput;
}

export interface RenderOutcome {
  exportId: string;
  outputPath: string;
  bytes: number;
  duration: number;
  timings: Record<string, number>;
}

type ProjectRow = Pick<ClipProjectRow, "id" | "user_id" | "source_url" | "duration_seconds" | "media_url" | "status"> & {
  clips: StoredClipMoment[] | null;
  transcript: [number, number, string, string?][] | null;
};

export async function runRenderJob({
  admin,
  browser,
  job,
  dir,
  signal,
  progress,
}: {
  admin: SupabaseClient;
  browser: RenderBrowser;
  job: RenderJob;
  /** A private scratch folder for this job (removed by the caller). */
  dir: string;
  signal: AbortSignal;
  progress: (stage: ClipJobStage, value: number) => void;
}): Promise<RenderOutcome> {
  const timings: Record<string, number> = {};
  const timed = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
    const started = Date.now();
    try {
      return await run();
    } finally {
      timings[name] = Date.now() - started;
    }
  };

  const { data: project } = await admin
    .from("clip_projects")
    .select("id, user_id, source_url, duration_seconds, media_url, status, clips, transcript")
    .eq("id", job.project_id)
    .maybeSingle<ProjectRow>();
  if (!project || project.status !== "ready") throw new JobError("fatal", "The video is gone or not ready.", false);
  const clip = project.clips?.find((c) => c.id === job.clip_id);
  if (!clip) throw new JobError("fatal", "The clip is gone.", false);
  const words: TranscriptWord[] = (project.transcript ?? []).map(([start, end, word]) => [start, end, word]);
  const { settings } = job.input;

  progress("fetching", 0);
  const source = await timed("fetchMs", () => fetchSource(admin, project, clip, settings, dir, signal, progress));
  const [trackPath, backgroundPath] = await timed("inputsMs", () =>
    Promise.all([
      job.input.trackPath ? download(admin, job.input.trackPath, path.join(dir, "track.bin")) : null,
      job.input.backgroundPath ? download(admin, job.input.backgroundPath, path.join(dir, "background.mp4")) : null,
    ])
  );

  progress("encoding", 0);
  const outputPath = path.join(dir, "clip.mp4");
  // Software H.264 on a server CPU runs ~2x realtime; anything far past that is stuck.
  const clipSeconds = Math.max(1, settings.end - settings.start);
  const result = await timed("renderMs", () =>
    browser.render(
      { offset: source.offset, settings, words, clip: { keywords: clip.keywords, emojis: clip.emojis } },
      { sourcePath: source.file, backgroundPath, trackPath, outputPath },
      {
        signal,
        timeoutMs: Math.max(5 * 60_000, clipSeconds * 20_000),
        onProgress: (stage: PageStage, value: number) => progress(stage === "tracking" ? "tracking" : "encoding", value),
      }
    )
  );
  if ("failed" in result) {
    if (result.name === "ClipAudioError") throw new JobError("no_audio", result.message, true);
    throw new JobError(result.fatal ? "fatal" : "render", result.message, !result.fatal);
  }

  progress("uploading", 0);
  const { size } = await stat(outputPath);
  if (size > CLIP_EXPORT_MAX_BYTES) throw new JobError("too_large", "This clip came out too large to save.", false);
  const storagePath = `${job.user_id}/${job.project_id}/${job.id}.mp4`;
  const exportId = await timed("saveMs", async () => {
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, await readFile(outputPath), { contentType: "video/mp4", upsert: true });
    if (uploadError) throw new JobError("upload", `Saving the clip failed: ${uploadError.message}`, true);
    return saveExport(admin, job, clip, storagePath, size, result.duration);
  });

  timings.trackMs = Math.round(result.trackMs);
  timings.encodeMs = Math.round(result.encodeMs);
  return { exportId, outputPath: storagePath, bytes: size, duration: result.duration, timings };
}

/** The library row for this render; a retry finds the one an earlier attempt made. */
async function saveExport(
  admin: SupabaseClient,
  job: RenderJob,
  clip: ClipMoment,
  storagePath: string,
  size: number,
  duration: number
): Promise<string> {
  const { settings } = job.input;
  const title = (settings.title || clip.title || "Clip").replace(/\s+/g, " ").trim().slice(0, 120) || "Clip";
  const { error } = await admin.from("clip_exports").upsert(
    {
      user_id: job.user_id,
      project_id: job.project_id,
      clip_id: job.clip_id,
      title,
      storage_path: storagePath,
      aspect: settings.aspect,
      duration_seconds: Math.round(duration * 100) / 100,
      size_bytes: size,
      render_job_id: job.id,
    },
    { onConflict: "render_job_id", ignoreDuplicates: true }
  );
  if (error) throw new JobError("save", `Recording the clip failed: ${error.message}`, true);
  const { data } = await admin
    .from("clip_exports")
    .select("id")
    .eq("render_job_id", job.id)
    .maybeSingle<{ id: string }>();
  if (!data) throw new JobError("save", "The saved clip wasn't recorded.", true);
  return data.id;
}

async function download(admin: SupabaseClient, storagePath: string, file: string): Promise<string> {
  const { data, error } = await admin.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new JobError("input", `An input of this render is missing (${storagePath}).`, false);
  await writeFile(file, Buffer.from(await data.arrayBuffer()));
  return file;
}

/**
 * The clip's cut to a local file: the stored pre-cut when it covers the
 * trim, else a read of the source (which this worker can afford: no 300s
 * function limit), on a fresh link if a read breaks.
 */
async function fetchSource(
  admin: SupabaseClient,
  project: ProjectRow,
  clip: StoredClipMoment,
  settings: ClipRenderInput["settings"],
  dir: string,
  signal: AbortSignal,
  progress: (stage: ClipJobStage, value: number) => void
): Promise<{ file: string; offset: number }> {
  const file = path.join(dir, "source.mp4");
  const cut = clip.cut;
  if (cut?.state === "stored" && cut.from <= settings.start && cut.to >= settings.end) {
    const parts: Buffer[] = [];
    for (let part = 0; part < cut.parts; part++) {
      const { data } = await admin.storage.from(CLIP_SOURCES_BUCKET).download(clipSourcePath(project, clip.id, part));
      if (!data) {
        parts.length = 0;
        break;
      }
      parts.push(Buffer.from(await data.arrayBuffer()));
      progress("fetching", (part + 1) / cut.parts);
    }
    if (parts.length === cut.parts) {
      await writeFile(file, Buffer.concat(parts));
      return { file, offset: cut.offset };
    }
  }

  const { from, to } = clipSourceRange(clip, project.duration_seconds);
  const range = paddedCutRange({ start: Math.min(from, settings.start), end: Math.max(to, settings.end) });
  let lastError: unknown = null;
  for (let read = 0; read < SOURCE_READS; read++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const out = createWriteStream(file);
    let offset = 0;
    // Set from the cut's callbacks, so typed wide (TS can't see those assignments).
    let state = "reading" as "reading" | "done" | "truncated";
    try {
      const stream = await openClipSource(project, signal, { fresh: read > 0 });
      await cutClipSource(
        project,
        stream,
        [range],
        async (event) => {
          if (event.type === "start") offset = event.offset;
          else if (event.type === "data") {
            if (!out.write(event.bytes)) await new Promise<void>((resolve) => out.once("drain", () => resolve()));
          } else if (event.type === "end") state = "done";
          else if (event.type === "failed") state = "truncated";
          else if (event.type === "progress") progress("fetching", Math.min(0.99, event.time / range.end));
        },
        signal
      );
    } catch (error) {
      lastError = error;
    } finally {
      await new Promise<void>((resolve) => out.end(() => resolve()));
    }
    if (state === "done") return { file, offset };
    lastError ??= new Error("The video ended before the clip did");
  }
  throw new JobError("source", `Reading the video failed: ${String(lastError)}`, true);
}
