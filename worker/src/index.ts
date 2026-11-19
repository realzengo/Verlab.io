import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RenderBrowser } from "./browser";
import { errorText, log } from "./log";
import { JobError, runRenderJob, type RenderJob } from "./jobs/render";
import type { ClipJobStage } from "@/lib/clip-jobs";

// The render worker: claims render jobs from clip_jobs (claim_clip_job, SKIP
// LOCKED), keeps each one's lease alive while it works, and records the
// outcome. Several renders run side by side (CLIP_WORKER_CONCURRENCY), each
// in its own Chrome page. On SIGTERM (a redeploy) it stops claiming and hands
// its running jobs back to the queue.
//
// Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
// SAVENOW_API_KEY (reading the source when no stored cut covers a clip),
// CLIP_WORKER_CONCURRENCY, CHROME_PATH, CHROME_NO_SANDBOX, CHROME_EXTRA_ARGS, FONTS_DIR.

const LEASE_MS = 60_000;
const HEARTBEAT_MS = 15_000;
const IDLE_POLL_MS = 2_000;
const EXPIRE_EVERY_MS = 60_000;
const PROGRESS_EVERY_MS = 1_000;
const RETRY_BACKOFF_MS = 30_000;

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  log("worker.config", { missing: !supabaseUrl ? "SUPABASE_URL" : "SUPABASE_SERVICE_ROLE_KEY" }, "error");
  process.exit(1);
}
// The app's server modules (cut-source, the admin client) read these names.
process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;

const admin: SupabaseClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const workerId = `${process.env.RAILWAY_REPLICA_ID ?? os.hostname()}:${process.pid}`;
const version = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "dev").slice(0, 7);
const concurrency = Math.max(1, Number(process.env.CLIP_WORKER_CONCURRENCY ?? 3));
const here = path.dirname(new URL(import.meta.url).pathname);

let stopping = false;
const running = new Map<string, AbortController>();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const leaseUntil = () => new Date(Date.now() + LEASE_MS).toISOString();

const browser = await RenderBrowser.launch({
  pageDir: path.join(here, "page"),
  fontsDir: process.env.FONTS_DIR ?? path.resolve(here, "../../public/fonts"),
  executablePath: process.env.CHROME_PATH || undefined,
  channel: "chrome",
  noSandbox: process.env.CHROME_NO_SANDBOX === "1",
  extraArgs: (process.env.CHROME_EXTRA_ARGS ?? "").split(/\s+/).filter(Boolean),
  log: (event, fields) => log(event, fields, "warn"),
});
const probe = await browser.probe();
log("worker.started", { workerId, version, concurrency, probe });
if (!probe.avc1080 && !probe.avc720) {
  log("worker.no_h264", { userAgent: probe.userAgent }, "error");
  process.exit(1);
}

async function checkIn() {
  const { error } = await admin.from("clip_workers").upsert({
    id: workerId,
    version,
    concurrency,
    encoder: "webcodecs",
    chrome: probe.userAgent.match(/HeadlessChrome\/[\d.]+/)?.[0] ?? null,
    last_seen: new Date().toISOString(),
  });
  if (error) log("worker.checkin_failed", { error: error.message }, "warn");
}

/** Writes progress and renews the lease; false when the job isn't ours any more (canceled, or reclaimed). */
async function touch(jobId: string, patch: Record<string, unknown> = {}): Promise<boolean> {
  const { data, error } = await admin
    .from("clip_jobs")
    .update({ ...patch, locked_until: leaseUntil() })
    .eq("id", jobId)
    .eq("locked_by", workerId)
    .eq("status", "running")
    .select("id");
  if (error) {
    log("job.touch_failed", { job: jobId, error: error.message }, "warn");
    return true; // A blip; the lease has a minute of slack.
  }
  return (data ?? []).length > 0;
}

async function finish(job: RenderJob & { max_attempts: number }, patch: Record<string, unknown>) {
  const { error } = await admin
    .from("clip_jobs")
    .update({ ...patch, locked_by: null, locked_until: null })
    .eq("id", job.id)
    .eq("locked_by", workerId)
    .eq("status", "running");
  if (error) log("job.finish_failed", { job: job.id, error: error.message }, "error");
}

async function work(job: RenderJob & { max_attempts: number; created_at: string }) {
  const abort = new AbortController();
  running.set(job.id, abort);
  const started = Date.now();
  const fields = { job: job.id, project: job.project_id, clip: job.clip_id, attempt: job.attempts };
  log("job.claimed", { ...fields, queuedMs: started - Date.parse(job.created_at) });

  let lastWrite = 0;
  let pending: { stage: ClipJobStage; progress: number } | null = null;
  let lastStage: ClipJobStage | null = null;
  const write = async () => {
    const patch = pending;
    pending = null;
    lastWrite = Date.now();
    if (!(await touch(job.id, patch ?? {}))) abort.abort();
  };
  const heartbeat = setInterval(() => {
    if (Date.now() - lastWrite >= HEARTBEAT_MS) void write();
  }, HEARTBEAT_MS / 3);
  const progress = (stage: ClipJobStage, value: number) => {
    pending = { stage, progress: Math.max(0, Math.min(1, value)) };
    if (stage !== lastStage) {
      lastStage = stage;
      log("job.stage", { ...fields, stage, ms: Date.now() - started });
      void write();
    } else if (Date.now() - lastWrite >= PROGRESS_EVERY_MS) void write();
  };

  const dir = await mkdtemp(path.join(os.tmpdir(), "verlab-render-"));
  try {
    const outcome = await runRenderJob({ admin, browser, job, dir, signal: abort.signal, progress });
    clearInterval(heartbeat);
    const ms = Date.now() - started;
    await finish(job, {
      status: "done",
      stage: null,
      progress: 1,
      export_id: outcome.exportId,
      output_path: outcome.outputPath,
      output_bytes: outcome.bytes,
      encoder: "webcodecs",
      timings: { ...outcome.timings, totalMs: ms },
      finished_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    });
    log("job.done", {
      ...fields,
      ms,
      seconds: Math.round(outcome.duration * 10) / 10,
      realtime: Math.round((outcome.duration / ((outcome.timings.encodeMs || ms) / 1000)) * 100) / 100,
      bytes: outcome.bytes,
      ...outcome.timings,
    });
  } catch (error) {
    clearInterval(heartbeat);
    if (abort.signal.aborted) {
      // Canceled (new settings), reclaimed, or shutting down: someone else owns the outcome.
      log("job.aborted", { ...fields, ms: Date.now() - started, stopping });
      return;
    }
    const code = error instanceof JobError ? error.code : "internal";
    const retry = error instanceof JobError ? error.retry : true;
    const message = errorText(error);
    const again = retry && job.attempts < job.max_attempts;
    await finish(
      job,
      again
        ? {
            status: "queued",
            stage: "waiting",
            progress: 0,
            run_after: new Date(Date.now() + RETRY_BACKOFF_MS * job.attempts).toISOString(),
            error_code: code,
            error_message: message,
          }
        : { status: "failed", error_code: code, error_message: message, finished_at: new Date().toISOString() }
    );
    log(again ? "job.retry" : "job.failed", { ...fields, ms: Date.now() - started, code, error: message }, "error");
  } finally {
    running.delete(job.id);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function slot(index: number) {
  while (!stopping) {
    const { data, error } = await admin.rpc("claim_clip_job", {
      p_worker: workerId,
      p_kinds: ["render"],
      p_lease_seconds: LEASE_MS / 1000,
    });
    if (error) {
      log("worker.claim_failed", { slot: index, error: error.message }, "warn");
      await sleep(IDLE_POLL_MS * 2);
      continue;
    }
    const job = (data as (RenderJob & { max_attempts: number; created_at: string })[] | null)?.[0];
    if (!job) {
      await sleep(IDLE_POLL_MS);
      continue;
    }
    await work(job);
  }
}

async function shutdown(signal: string, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  log("worker.stopping", { signal, running: running.size });
  const ids = [...running.keys()];
  for (const abort of running.values()) abort.abort();
  if (ids.length) {
    // Back in line for the next worker, without spending an attempt's backoff.
    await admin
      .from("clip_jobs")
      .update({ status: "queued", stage: "waiting", progress: 0, locked_by: null, locked_until: null, run_after: new Date().toISOString() })
      .in("id", ids)
      .eq("locked_by", workerId)
      .eq("status", "running");
  }
  await admin.from("clip_workers").delete().eq("id", workerId);
  await browser.close();
  process.exit(exitCode);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await checkIn();
setInterval(() => void checkIn(), HEARTBEAT_MS);
setInterval(() => {
  void admin.rpc("expire_clip_jobs").then(({ data, error }) => {
    if (error) log("worker.expire_failed", { error: error.message }, "warn");
    else if (data) log("worker.expired", { jobs: data });
  });
}, EXPIRE_EVERY_MS);
// Chrome itself dying would fail every render after it: let Railway restart the worker.
setInterval(() => {
  if (!browser.connected && !stopping) {
    log("worker.chrome_lost", {}, "error");
    void shutdown("chrome_lost", 1);
  }
}, 5_000);

await Promise.all(Array.from({ length: concurrency }, (_, index) => slot(index)));
