"use client";

import { useEffect, useSyncExternalStore } from "react";
import { mutate } from "swr";
import type { ClipEditSettings } from "@/lib/client/clip-render";
import type { ClipJobStage, ClipRenderJob } from "@/lib/clip-jobs";
import type { ClipMoment, ClipProject } from "@/lib/clips";
import type { RenderState } from "@/components/clipping/useClipWorkspace";

// Every export the app knows about, outside React so it outlives the page
// that started it (Your clips shows it live). Two kinds:
//   - browser renders: this tab encodes; closing or reloading it stops them,
//     so it asks first;
//   - server renders (`server` set): the render worker encodes; this store
//     only polls their progress, picks them up again after a reload
//     (hydrateServerRenders), and the tab can close at any time.

export interface RenderEntry extends RenderState {
  /** `${projectId}:${clipId}` */
  key: string;
  projectId: string;
  project: Pick<ClipProject, "title" | "thumbnailUrl">;
  clip: ClipMoment;
  /** The settings it was queued (then rendered) with. */
  settings: ClipEditSettings;
  /** Global queue order: renders run one at a time, across projects. */
  seq: number;
  /** Getting the clip's cut (or its face tracking) before encoding. */
  preparing?: boolean;
  /** Rendered by the worker, not this tab. */
  server?: { jobId: string; stage: ClipJobStage | null; ahead: number };
}

let entries: RenderEntry[] = [];
let seq = 0;
const listeners = new Set<() => void>();
// One encoder at a time, whichever project queued it.
let chain: Promise<unknown> = Promise.resolve();

const renderKey = (projectId: string, clipId: string) => `${projectId}:${clipId}`;

function emit() {
  syncUnloadGuard();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => entries;
const empty: RenderEntry[] = [];

/** Every render this tab has queued, in queue order (plus the user's server renders still under way). */
export function useClipRenders(): RenderEntry[] {
  useEffect(() => {
    void hydrateServerRenders();
  }, []);
  return useSyncExternalStore(subscribe, snapshot, () => empty);
}

export function rendersFor(projectId: string): RenderEntry[] {
  return entries.filter((entry) => entry.projectId === projectId);
}

export function getRender(projectId: string, clipId: string): RenderEntry | undefined {
  return entries.find((entry) => entry.key === renderKey(projectId, clipId));
}

/**
 * Marks clips as waiting (moving them to the back of the queue) and returns
 * the seq each one was queued with, so a newer queueing can supersede it.
 */
export function queueRenders(
  projectId: string,
  project: RenderEntry["project"],
  items: { clip: ClipMoment; settings: ClipEditSettings }[]
): Map<string, number> {
  const tokens = new Map<string, number>();
  const keys = new Set(items.map(({ clip }) => renderKey(projectId, clip.id)));
  for (const entry of entries) {
    if (keys.has(entry.key) && entry.url) URL.revokeObjectURL(entry.url);
  }
  const queued = items.map(({ clip, settings }) => {
    const entry: RenderEntry = {
      key: renderKey(projectId, clip.id),
      projectId,
      project,
      clip,
      settings,
      seq: ++seq,
      status: "waiting",
      progress: 0,
    };
    tokens.set(clip.id, entry.seq);
    return entry;
  });
  entries = [...entries.filter((entry) => !keys.has(entry.key)), ...queued];
  emit();
  return tokens;
}

/** Updates a render, unless it has since been queued again (`seq` no longer matches). */
export function updateRender(
  projectId: string,
  clipId: string,
  token: number,
  patch: Partial<Omit<RenderEntry, "key" | "projectId" | "seq">>
) {
  const key = renderKey(projectId, clipId);
  let changed = false;
  entries = entries.map((entry) => {
    if (entry.key !== key || entry.seq !== token) return entry;
    changed = true;
    return { ...entry, ...patch };
  });
  if (changed) emit();
}

export function isCurrentRender(projectId: string, clipId: string, token: number): boolean {
  return getRender(projectId, clipId)?.seq === token;
}

/** Runs `job` after every render queued before it. */
export function runInQueue(job: () => Promise<void>): Promise<void> {
  const next = chain.then(job, job);
  chain = next.catch(() => {});
  return next;
}

/** How many renders go before this one: the one encoding plus the waiting ones queued earlier. */
export function rendersAhead(all: RenderEntry[], entry: RenderEntry): number {
  if (entry.status !== "waiting") return -1;
  // The worker's queue is shared with everyone: the server says where it stands.
  if (entry.server) return entry.server.ahead;
  return all.filter(
    (other) => other.status === "rendering" || (other.status === "waiting" && other.seq < entry.seq)
  ).length;
}

/** Still rendering, still saving, or finished but not saved: closing the tab would lose it. */
export function isUnsettled(entry: RenderEntry): boolean {
  // The worker carries on without this tab.
  if (entry.server) return false;
  return (
    entry.status === "waiting" ||
    entry.status === "rendering" ||
    (entry.status === "done" && entry.saved !== "saved")
  );
}

const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
let guarding = false;

function syncUnloadGuard() {
  if (typeof window === "undefined") return;
  const needed = entries.some(isUnsettled);
  if (needed === guarding) return;
  guarding = needed;
  if (needed) window.addEventListener("beforeunload", warnBeforeUnload);
  else window.removeEventListener("beforeunload", warnBeforeUnload);
}

/* ── Server renders ──────────────────────────────────────────────────── */

const POLL_MS = 1500;
let polling: ReturnType<typeof setInterval> | null = null;
let polls = 0;
const failureHandlers = new Map<string, (clipId: string) => void>();
const STAGE_LABELS: Partial<Record<ClipJobStage, string>> = {
  fetching: "Getting the video",
  tracking: "Tracking faces",
  uploading: "Saving",
};

const exportsKeyOf = (projectId: string) => `/api/clips/${projectId}/exports`;

/** The worker's view of a render, in the store's terms. */
function fromJob(job: ClipRenderJob): Partial<RenderEntry> & Pick<RenderEntry, "status" | "progress"> {
  const server = { jobId: job.id, stage: job.stage, ahead: job.ahead };
  if (job.status === "done" && job.export) {
    return {
      server,
      status: "done",
      progress: 1,
      preparing: false,
      url: job.export.url,
      downloadUrl: job.export.downloadUrl,
      size: job.export.sizeBytes,
      duration: job.export.durationSeconds,
      saved: "saved",
      stageLabel: undefined,
    };
  }
  if (job.status === "failed" || (job.status === "done" && !job.export)) {
    return { server, status: "error", progress: 0, preparing: false, error: job.error ?? "We couldn't render this clip." };
  }
  if (job.status === "running" && job.stage === "encoding") {
    return { server, status: "rendering", progress: Math.min(0.99, job.progress), preparing: false, stageLabel: undefined };
  }
  if (job.status === "running") {
    return {
      server,
      status: "waiting",
      progress: 0,
      preparing: true,
      stageLabel: (job.stage && STAGE_LABELS[job.stage]) || undefined,
    };
  }
  return { server, status: "waiting", progress: 0, preparing: false, stageLabel: undefined };
}

/**
 * Hands clips the worker took to the store: each entry (queued in this tab
 * with `token`) becomes a server render, polled from now on.
 */
export function adoptServerRenders(projectId: string, tokens: Map<string, number>, jobs: ClipRenderJob[]) {
  for (const job of jobs) {
    const token = tokens.get(job.clipId);
    if (token != null) updateRender(projectId, job.clipId, token, fromJob(job));
  }
  ensurePolling();
}

/** Called when a server render fails for good while a project's editor is open (it renders the clip itself). */
export function onServerRenderFailure(projectId: string, handler: (clipId: string) => void) {
  failureHandlers.set(projectId, handler);
  return () => {
    if (failureHandlers.get(projectId) === handler) failureHandlers.delete(projectId);
  };
}

function applyJobs(jobs: (ClipRenderJob & { project?: RenderEntry["project"]; clip?: ClipMoment })[]) {
  let changed = false;
  const finished = new Set<string>();
  const failed: { projectId: string; clipId: string }[] = [];
  const next = entries.map((entry) => {
    if (!entry.server) return entry;
    const job = jobs.find((j) => j.projectId === entry.projectId && j.clipId === entry.clip.id);
    // A newer render of the clip replaced this one, or it was canceled: the newer one reports itself.
    if (!job || job.id !== entry.server.jobId) return entry;
    const patch = fromJob(job);
    if (patch.status === "done" && entry.status !== "done") finished.add(entry.projectId);
    if (patch.status === "error" && entry.status !== "error") failed.push({ projectId: entry.projectId, clipId: entry.clip.id });
    changed = true;
    return { ...entry, ...patch };
  });

  // Renders this tab didn't know about (another tab, or before a reload).
  for (const job of jobs) {
    if (!job.project || !job.clip || job.status === "canceled") continue;
    if (next.some((entry) => entry.projectId === job.projectId && entry.clip.id === job.clipId)) continue;
    next.push({
      key: renderKey(job.projectId, job.clipId),
      projectId: job.projectId,
      project: job.project,
      clip: job.clip,
      settings: job.settings,
      seq: ++seq,
      ...fromJob(job),
    });
    changed = true;
  }

  if (!changed) return;
  entries = next;
  emit();
  for (const projectId of finished) {
    void mutate(exportsKeyOf(projectId));
    void mutate("/api/clips/exports");
  }
  for (const { projectId, clipId } of failed) failureHandlers.get(projectId)?.(clipId);
}

const liveServerEntries = () =>
  entries.filter((entry) => entry.server && (entry.status === "waiting" || entry.status === "rendering"));

async function pollOnce() {
  const projects = [...new Set(liveServerEntries().map((entry) => entry.projectId))];
  if (!projects.length) {
    if (polling) clearInterval(polling);
    polling = null;
    return;
  }
  await Promise.all(
    projects.map(async (projectId) => {
      try {
        const response = await fetch(`/api/clips/${projectId}/renders`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { jobs?: ClipRenderJob[] };
        applyJobs(data.jobs ?? []);
      } catch {
        // Offline for a moment; the next poll catches up.
      }
    })
  );
}

function ensurePolling() {
  if (polling || typeof window === "undefined") return;
  polling = setInterval(() => {
    // One poll at a time, however slow the network.
    if (polls > 0) return;
    polls++;
    void pollOnce().finally(() => polls--);
  }, POLL_MS);
}

let hydrated = false;

/** Picks up the user's server renders still under way (once per page load). */
export async function hydrateServerRenders() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const response = await fetch("/api/clips/renders", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as {
      jobs?: (ClipRenderJob & { project: RenderEntry["project"]; clip: ClipMoment })[];
    };
    if (data.jobs?.length) {
      applyJobs(data.jobs);
      ensurePolling();
    }
  } catch {
    hydrated = false;
  }
}
