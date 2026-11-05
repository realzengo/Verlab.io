import { mutate } from "swr";
import { notifyCreditsChanged } from "@/lib/client/credits-bus";

// The Script Writer's in-flight generation, kept at module scope rather than
// in the /scripts page component so it outlives leaving the page: client-side
// navigation unmounts the page but not the fetch below, so coming back picks
// the live stream up mid-way. A reload or closed tab does end the fetch --
// api/generate-script keeps writing and saves the script regardless -- so the
// job is mirrored to localStorage too, and the next visit watches history for
// the row id chosen here instead of the stream.

export interface ScriptGenerationJob {
  /** The scripts row id generate-script saves the result under. */
  id: string;
  startedAt: number;
  /** Text streamed so far -- stays empty for a job resumed after a reload. */
  text: string;
  status: "generating" | "done" | "failed";
  error: string | null;
  /** Restored from localStorage: no live stream, completion comes from history. */
  resumed: boolean;
  /** The user closed the progress popup -- don't reopen it on return. */
  dismissed: boolean;
}

export interface ScriptGenerationInput {
  message: string;
  sop?: string;
  transcripts?: string;
}

const STORAGE_KEY = "clypa:script-generation";

// generate-script's maxDuration (300s) plus slack -- a resumed job whose
// script still isn't in history by then never finished.
export const SCRIPT_JOB_MAX_AGE_MS = 6 * 60 * 1000;

let job: ScriptGenerationJob | null = null;
const listeners = new Set<() => void>();

function setJob(next: ScriptGenerationJob | null): void {
  job = next;
  for (const listener of listeners) listener();
}

function patchJob(id: string, patch: Partial<ScriptGenerationJob>): void {
  if (job?.id === id) setJob({ ...job, ...patch });
}

function persist(id: string, startedAt: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, startedAt }));
  } catch {
    // Storage unavailable -- resuming after a reload is a nicety, not required.
  }
}

function forget(id: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && JSON.parse(raw)?.id === id) localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same as persist() -- never let storage break the generation flow.
  }
}

export function subscribeScriptJob(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getScriptJob(): ScriptGenerationJob | null {
  return job;
}

export function getServerScriptJob(): ScriptGenerationJob | null {
  return null;
}

/** Picks back up a generation that was still running when the page last unloaded. */
export function restoreScriptJob(): void {
  if (job) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved?.id !== "string" || typeof saved?.startedAt !== "number" || Date.now() - saved.startedAt > SCRIPT_JOB_MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    setJob({ id: saved.id, startedAt: saved.startedAt, text: "", status: "generating", error: null, resumed: true, dismissed: false });
  } catch {
    // Corrupt/unavailable storage -- nothing to resume.
  }
}

/** The job's script showed up in history -- the only way a resumed job learns it finished. */
export function settleScriptJob(id: string): void {
  forget(id);
  if (job?.id === id && job.status === "generating") patchJob(id, { status: "done" });
}

export function failScriptJob(id: string, error: string): void {
  forget(id);
  patchJob(id, { status: "failed", error });
}

export function dismissScriptJob(): void {
  if (job) patchJob(job.id, { dismissed: true });
}

/**
 * Starts a generation and streams it into the module-level job. Resolves once
 * the stream ends (or fails) -- callers don't need to stay mounted for that.
 */
export async function startScriptGeneration(input: ScriptGenerationInput): Promise<"started" | "insufficient-credits"> {
  const id = crypto.randomUUID();
  const startedAt = Date.now();
  setJob({ id, startedAt, text: "", status: "generating", error: null, resumed: false, dismissed: false });
  persist(id, startedAt);

  try {
    const response = await fetch("/api/generate-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, scriptId: id }),
    });

    if (!response.ok || !response.body) {
      if (response.status === 402) {
        forget(id);
        if (job?.id === id) setJob(null);
        return "insufficient-credits";
      }
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? "Failed to generate script.");
    }

    // generate-script/route.ts charges before it ever starts streaming, so
    // the balance has already changed by the time this response resolves
    // — no need to wait for the stream to finish reading.
    notifyCreditsChanged();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (job?.id === id) patchJob(id, { text: job.text + chunk });
    }

    // The route saves the row before closing the stream, so it's already
    // there -- refresh the shared SWR cache even if /scripts isn't mounted.
    forget(id);
    patchJob(id, { status: "done" });
    void mutate("/api/scripts");
  } catch (err) {
    failScriptJob(id, err instanceof Error ? err.message : "Something went wrong. Try again.");
  }

  return "started";
}
