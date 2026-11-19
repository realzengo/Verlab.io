// Shared between the editor, the API and the render worker (worker/): the
// shape of a server render and how its settings are fingerprinted. No server
// or browser APIs here.

import type { ClipEditSettings } from "@/lib/client/clip-render";

/**
 * Bump whenever the renderer's output changes (painter, captions, layouts,
 * encoding). It's part of every render's dedupe key, so a finished render is
 * only reused while it would still come out the same.
 */
export const RENDERER_VERSION = 2;

export type ClipJobStatus = "queued" | "running" | "done" | "failed" | "canceled";
export type ClipJobStage = "waiting" | "fetching" | "tracking" | "encoding" | "uploading";

/** What a render job is given (clip_jobs.input). */
export interface ClipRenderInput {
  settings: ClipEditSettings;
  /** The editor's face track for this clip (Storage path, gzipped), or null for a centered crop. */
  trackPath: string | null;
  /** The split layout's bottom video (Storage path), when the clip uses one. */
  backgroundPath: string | null;
}

/** One clip's server render, as GET /api/clips/[id]/renders reports it. */
export interface ClipRenderJob {
  id: string;
  projectId: string;
  clipId: string;
  status: ClipJobStatus;
  stage: ClipJobStage | null;
  progress: number;
  /** Renders queued ahead of this one (any user's), while it waits. */
  ahead: number;
  /** Why it failed, in words for the user. */
  error: string | null;
  /** The saved clip, once done (signed URLs). */
  export: { id: string; url: string; downloadUrl: string; sizeBytes: number; durationSeconds: number } | null;
  settings: ClipEditSettings;
  createdAt: string;
  finishedAt: string | null;
}

/** A clip's render request (POST /api/clips/[id]/renders). */
export interface ClipRenderRequest {
  clipId: string;
  settings: ClipEditSettings;
  trackPath?: string | null;
  backgroundPath?: string | null;
}

/** Live (still working) render statuses. */
export const LIVE_RENDER_STATUSES: ClipJobStatus[] = ["queued", "running"];

/**
 * JSON with object keys sorted at every level, so the same settings always
 * hash the same however they were built.
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Storage paths a render's inputs are uploaded to, inside the project's folder. */
export const renderInputPath = {
  track: (userId: string, projectId: string, clipId: string, hash: string) =>
    `${userId}/${projectId}/inputs/track-${clipId}-${hash}.bin`,
  background: (userId: string, projectId: string, hash: string) => `${userId}/${projectId}/inputs/bg-${hash}.mp4`,
};

export const isRenderInputPath = (name: string) => name.startsWith("inputs/");
