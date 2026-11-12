"use client";

import { useSyncExternalStore } from "react";
import type { ClipEditSettings } from "@/lib/client/clip-render";
import type { ClipMoment, ClipProject } from "@/lib/clips";
import type { RenderState } from "@/components/clipping/useClipWorkspace";

// Exports render in the browser, so they used to stop the moment the project
// page unmounted. They live here instead, outside React: a render keeps going
// while the user moves around the app (Your clips shows it live), and only
// closing or reloading the tab stops it, which asks first.

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

/** Every render this tab has queued, in queue order. */
export function useClipRenders(): RenderEntry[] {
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
  return all.filter(
    (other) => other.status === "rendering" || (other.status === "waiting" && other.seq < entry.seq)
  ).length;
}

/** Still rendering, still saving, or finished but not saved: closing the tab would lose it. */
export function isUnsettled(entry: RenderEntry): boolean {
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
