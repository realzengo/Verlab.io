"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mutate } from "swr";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  ClipAudioError,
  ClipRenderError,
  MAX_MISSING_VIDEO,
  MIN_SOURCE_AUDIO,
  checkClipCut,
  exportClip,
  fetchClipAudio,
  fetchClipSources,
  isRtlClip,
  usesTracking,
  withClipAudio,
  type ClipEditSettings,
  type ClipSource,
} from "@/lib/client/clip-render";
import { analyzeReframe, type ReframeTrack } from "@/lib/client/clip-reframe";
import { encodeTrack, sha256Hex } from "@/lib/client/clip-track-io";
import type { ClipRenderJob, ClipRenderRequest } from "@/lib/clip-jobs";
import { defaultSettings } from "@/lib/client/clip-defaults";
import {
  CLIP_EXPORT_MAX_BYTES,
  clipSourceRange,
  type ClipMoment,
  type ClipProject,
  type ClipStoredSource,
} from "@/lib/clips";
import {
  adoptServerRenders,
  getRender,
  isCurrentRender,
  onServerRenderFailure,
  queueRenders,
  runInQueue,
  updateRender,
  useClipRenders,
} from "@/components/clipping/renderQueue";

// Everything the Edit and Post steps share for one project: each clip's
// settings, its cut of the source video, its face-tracking path, the split
// screen's background, and its rendered MP4 (saved to the library once
// rendered). Lives above both steps so moving between them keeps the work.
// Renders themselves live in renderQueue, so leaving the page doesn't stop them.

export interface SourceState {
  status: "loading" | "ready" | "error";
  /** The source range the cut covers; trims can't leave it. */
  from: number;
  to: number;
  source?: ClipSource;
  url?: string;
  error?: string;
  startedAt: number;
  /** How far into the source the server's read has got (seconds), while loading. */
  reached?: number;
}

export interface TrackState {
  status: "waiting" | "running" | "ready" | "error";
  progress: number;
  track?: ReframeTrack;
}

export interface RenderState {
  status: "waiting" | "rendering" | "done" | "error";
  progress: number;
  url?: string;
  size?: number;
  duration?: number;
  error?: string;
  /** Saving to the library happens right after rendering. */
  saved?: "saving" | "saved" | "failed" | "too-large";
  /** A server render's file, signed to download under the clip's name (a cross-origin `url` can't be). */
  downloadUrl?: string;
  /** What a server render is doing before it encodes ("Getting the video", "Tracking faces"). */
  stageLabel?: string;
}

export interface BackgroundVideo {
  file: File;
  url: string;
  name: string;
}

// Most cuts one request carries (the route's own cap).
const BATCH_MAX = 12;
// How often to look again for clips the server is still cutting.
const STORED_POLL_MS = 2500;
// Reads of the source per clip before its error shows: the first, then fresh provider links.
const SOURCE_TRIES = 3;
// Pause before a retry read; failures that land together are retried in one read.
const SOURCE_RETRY_MS = 1500;
// A failed read that took longer than this is retried once at most.
const SLOW_READ_MS = 90_000;
// Saving a finished clip to the library, tries and pause between them.
const SAVE_TRIES = 3;
const SAVE_RETRY_MS = 2000;

/** The parts of the settings that are style, not content: "Apply to all" copies these. */
const STYLE_KEYS = [
  "aspect",
  "layouts",
  "bottomVideo",
  "reframe",
  "camera",
  "zoom",
  "captions",
  "captionPosition",
  "captionX",
  "captionY",
  "captionFont",
  "captionSize",
  "captionWords",
  "captionColor",
  "emojis",
  "hookTitle",
  "hookStyle",
  "hookFont",
  "hookSize",
  "hookPosition",
  "hookX",
  "hookY",
  "hookColor",
  "hookMotion",
  "hookUpper",
  "hookSeconds",
  "removePauses",
] as const satisfies (keyof ClipEditSettings)[];

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // Rejections are surfaced through state; don't let an unawaited one go unhandled.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

export const exportsKey = (projectId: string) => `/api/clips/${projectId}/exports`;

// Whether the render worker takes renders right now, asked at most every 20s.
const SERVER_CHECK_MS = 20_000;
const serverChecks = new Map<string, { at: number; available: Promise<boolean> }>();

function serverTakesRenders(projectId: string): Promise<boolean> {
  const cached = serverChecks.get(projectId);
  if (cached && Date.now() - cached.at < SERVER_CHECK_MS) return cached.available;
  const available = fetch(`/api/clips/${projectId}/renders`, { cache: "no-store" })
    .then(async (response) => response.ok && ((await response.json()) as { serverAvailable?: boolean }).serverAvailable === true)
    .catch(() => false);
  serverChecks.set(projectId, { at: Date.now(), available });
  return available;
}

/** The clips the server has cut ahead (GET /api/clips/[id]/sources); null if that check fails. */
async function fetchStoredSources(projectId: string, signal: AbortSignal) {
  try {
    const response = await fetch(`/api/clips/${projectId}/sources`, { cache: "no-store", signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { sources?: Record<string, ClipStoredSource> };
    return data.sources ?? null;
  } catch {
    return null;
  }
}

/** A stored cut's parts, joined back into one fMP4. */
async function downloadStoredSource(
  stored: Extract<ClipStoredSource, { state: "stored" }>,
  signal: AbortSignal
): Promise<ClipSource> {
  const parts = await Promise.all(
    stored.urls.map(async (url) => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Stored cut returned ${response.status}`);
      return response.blob();
    })
  );
  return { blob: new Blob(parts, { type: "video/mp4" }), offset: stored.offset };
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });

type SourceRequest = { clip: ClipMoment; from: number; to: number };

/** A save that failed; `retryable` when trying again can't record the clip twice. */
class SaveError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "SaveError";
  }
}

async function saveToLibrary(
  projectId: string,
  clip: ClipMoment,
  settings: ClipEditSettings,
  blob: Blob,
  duration: number
) {
  const meta = {
    clipId: clip.id,
    title: settings.title || clip.title,
    aspect: settings.aspect,
    durationSeconds: duration,
  };
  const prepare = await fetch(exportsKey(projectId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...meta, sizeBytes: blob.size }),
  });
  const prepared = (await prepare.json().catch(() => null)) as {
    exportId?: string;
    path?: string;
    token?: string;
  } | null;
  if (!prepare.ok || !prepared?.exportId || !prepared.path || !prepared.token) {
    throw new SaveError("prepare failed", prepare.status !== 400 && prepare.status !== 413);
  }

  const { error } = await createBrowserClient()
    .storage.from("clip-exports")
    .uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: "video/mp4" });
  if (error) throw new SaveError(`upload failed: ${error.message}`, true);

  // A confirm whose answer never came may have saved the clip: trying again
  // could record it twice, so only an answered "no" is retried (each try
  // prepares a new export, and a refused confirm removes its upload).
  let confirm: Response;
  try {
    confirm = await fetch(exportsKey(projectId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...meta, exportId: prepared.exportId }),
    });
  } catch {
    throw new SaveError("confirm unanswered", false);
  }
  if (!confirm.ok) throw new SaveError("confirm failed", confirm.status !== 400);
}

/** saveToLibrary, tried again after a pause when that's safe (see SaveError). */
async function saveWithRetries(...args: Parameters<typeof saveToLibrary>) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await saveToLibrary(...args);
    } catch (error) {
      if (attempt >= SAVE_TRIES || (error instanceof SaveError && !error.retryable)) throw error;
      console.warn(`[clips] saving to the library failed (try ${attempt}); trying again:`, error);
      await new Promise((resolve) => setTimeout(resolve, SAVE_RETRY_MS * attempt));
    }
  }
}

export function useClipWorkspace(project: ClipProject) {
  const [settings, setSettings] = useState<Record<string, ClipEditSettings>>({});
  const [sources, setSources] = useState<Record<string, SourceState>>({});
  const [tracks, setTracks] = useState<Record<string, TrackState>>({});
  const [background, setBackgroundState] = useState<BackgroundVideo | null>(null);
  // Where Export renders: on the render worker (true) or in this tab; null until known.
  const [serverRenders, setServerRenders] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void serverTakesRenders(project.id).then((available) => {
      if (live) setServerRenders(available);
    });
    return () => {
      live = false;
    };
  }, [project.id]);

  // Read by exportClips, which runs across many renders.
  const settingsRef = useRef(settings);
  const backgroundRef = useRef(background);
  useEffect(() => {
    settingsRef.current = settings;
    backgroundRef.current = background;
  }, [settings, background]);
  const sourceJobs = useRef(new Map<string, Deferred<ClipSource>>());
  // Failed reads so far per clip (see SOURCE_TRIES), and the cuts waiting to be read again.
  const sourceTries = useRef(new Map<string, number>());
  const cutStartedAt = useRef(new Map<string, number>());
  // sourceFailed, for sourceReady (declared before it) to hand back a cut that came incomplete.
  const sourceFailedRef = useRef<(item: SourceRequest, message: string) => void>(() => {});
  const retryQueue = useRef<SourceRequest[]>([]);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackJobs = useRef(new Map<string, Deferred<ReframeTrack>>());
  const batch = useRef<SourceRequest[]>([]);
  const batchScheduled = useRef(false);
  const trackChain = useRef<Promise<unknown>>(Promise.resolve());
  const abort = useRef(new AbortController());
  const urls = useRef(new Set<string>());
  // Exports queued or running from this workspace. Leaving the page while
  // there are any keeps their cuts, tracking and encoding going; the
  // cleanup waits until the last one is done.
  const exportsPending = useRef(0);
  const cleanupLater = useRef<(() => void) | null>(null);
  // A server render's inputs, uploaded once per content (by hash).
  const inputUploads = useRef(new Map<string, Promise<string>>());

  // Created here, not at first render: StrictMode's rehearsal unmount would
  // otherwise leave every later request holding an already-aborted signal.
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    const objectUrls = urls.current;
    const cleanup = () => {
      controller.abort();
      for (const url of objectUrls) URL.revokeObjectURL(url);
      objectUrls.clear();
    };
    return () => {
      if (exportsPending.current > 0) cleanupLater.current = cleanup;
      else cleanup();
    };
  }, []);

  const allRenders = useClipRenders();
  const renders = useMemo(() => {
    const mine: Record<string, RenderState> = {};
    for (const entry of allRenders) if (entry.projectId === project.id) mine[entry.clip.id] = entry;
    return mine;
  }, [allRenders, project.id]);

  const clips = useMemo(() => project.clips ?? [], [project.clips]);
  // Clips spoken in Arabic script (Darija included) start in the Arabic font.
  const rtlClips = useMemo(
    () => new Set(clips.filter((clip) => isRtlClip(project.transcript ?? [], clip.start, clip.end)).map((c) => c.id)),
    [clips, project.transcript]
  );
  const defaultsFor = useCallback((clip: ClipMoment) => defaultSettings(clip, rtlClips.has(clip.id)), [rtlClips]);
  const settingsFor = useCallback(
    (clip: ClipMoment) => settings[clip.id] ?? getRender(project.id, clip.id)?.settings ?? defaultsFor(clip),
    [settings, defaultsFor, project.id]
  );

  const updateSettings = useCallback(
    (clip: ClipMoment, patch: Partial<ClipEditSettings>) => {
      setSettings((current) => ({
        ...current,
        [clip.id]: { ...(current[clip.id] ?? getRender(project.id, clip.id)?.settings ?? defaultsFor(clip)), ...patch },
      }));
    },
    [defaultsFor, project.id]
  );

  /** Copies one clip's style (not its title, hook text or trim) to others. */
  const applyStyleToAll = useCallback(
    (from: ClipMoment, targets: ClipMoment[]) => {
      setSettings((current) => {
        const style = current[from.id] ?? defaultsFor(from);
        const next = { ...current };
        for (const clip of targets) {
          if (clip.id === from.id) continue;
          const base = next[clip.id] ?? defaultsFor(clip);
          next[clip.id] = {
            ...base,
            ...Object.fromEntries(
              STYLE_KEYS.map((key) => [key, Array.isArray(style[key]) ? [...style[key]] : style[key]])
            ),
          };
        }
        return next;
      });
    },
    [defaultsFor]
  );

  const setBackground = useCallback((file: File | null) => {
    setBackgroundState((current) => {
      if (current) URL.revokeObjectURL(current.url);
      if (!file) return null;
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      return { file, url, name: file.name };
    });
  }, []);

  /** Face tracking runs one clip at a time; it shares the GPU with the preview. */
  const startTrack = useCallback((clip: ClipMoment, source: ClipSource, from: number, to: number) => {
    if (trackJobs.current.has(clip.id)) return;
    const job = deferred<ReframeTrack>();
    trackJobs.current.set(clip.id, job);
    setTracks((current) => ({ ...current, [clip.id]: { status: "waiting", progress: 0 } }));
    trackChain.current = trackChain.current.then(async () => {
      if (abort.current.signal.aborted) return;
      setTracks((current) => ({ ...current, [clip.id]: { status: "running", progress: 0 } }));
      try {
        const track = await analyzeReframe(
          source,
          from,
          to,
          (progress) => setTracks((current) => ({ ...current, [clip.id]: { status: "running", progress } })),
          abort.current.signal
        );
        setTracks((current) => ({ ...current, [clip.id]: { status: "ready", progress: 1, track } }));
        job.resolve(track);
      } catch (error) {
        console.error("[clips] face tracking failed:", error);
        setTracks((current) => ({ ...current, [clip.id]: { status: "error", progress: 0 } }));
        job.reject(error);
      }
    });
  }, []);

  /**
   * The cut, checked before anyone sees it. Its video stopping short of the
   * clip (a read cut off early, or such a cut stored before that was caught)
   * makes it null: it gets read again. Its sound missing over the clip (the
   * provider's merge lost it) gets the project's mp3 put in. If that fails
   * too, the cut goes on as it came and the render's own check catches a
   * silent result.
   */
  const checkCut = useCallback(
    async ({ clip, from, to }: SourceRequest, source: ClipSource): Promise<ClipSource | null> => {
      const signal = abort.current.signal;
      const { missingVideo, audio } = await checkClipCut(source, clip.start, clip.end);
      if (missingVideo > MAX_MISSING_VIDEO) {
        console.warn(`[clips] ${clip.id}: the cut misses ${missingVideo.toFixed(1)}s of the clip`);
        return null;
      }
      if (audio >= MIN_SOURCE_AUDIO || signal.aborted) return source;
      console.warn(`[clips] ${clip.id}: ${Math.round(audio * 100)}% of the cut has sound; using the project's audio`);
      try {
        return await withClipAudio(source, await fetchClipAudio(project.id, from, to, signal));
      } catch (error) {
        if (!signal.aborted) console.error("[clips] couldn't fill in the clip's sound:", error);
        return source;
      }
    },
    [project.id]
  );

  const sourceReady = useCallback(
    async (item: SourceRequest, cut: ClipSource) => {
      const { clip, from, to } = item;
      const source = await checkCut(item, cut);
      if (!source) {
        sourceFailedRef.current(item, "This clip's video came through incomplete. Try again.");
        return;
      }
      sourceTries.current.delete(clip.id);
      const url = URL.createObjectURL(source.blob);
      urls.current.add(url);
      setSources((current) => ({ ...current, [clip.id]: { ...current[clip.id], status: "ready", source, url } }));
      sourceJobs.current.get(clip.id)?.resolve(source);
      startTrack(clip, source, from, to);
    },
    [startTrack, checkCut]
  );

  // Set below: a failed cut is read again through cutSources, which is declared after this.
  const retryCut = useRef<(item: SourceRequest) => void>(() => {});

  const sourceFailed = useCallback((item: SourceRequest, message: string) => {
    const { clip } = item;
    const tries = (sourceTries.current.get(clip.id) ?? 0) + 1;
    // A read that ran for minutes before failing gets one more go, not two:
    // the user would wait that long again each time.
    const slow = Date.now() - (cutStartedAt.current.get(clip.id) ?? Date.now()) > SLOW_READ_MS;
    if (tries < (slow ? 2 : SOURCE_TRIES) && !abort.current.signal.aborted) {
      // Read again on a fresh link; the clip stays "loading" meanwhile.
      sourceTries.current.set(clip.id, tries);
      console.warn(`[clips] cutting ${clip.id} failed (${message}); reading it again`);
      retryCut.current(item);
      return;
    }
    sourceTries.current.delete(clip.id);
    const job = sourceJobs.current.get(clip.id);
    sourceJobs.current.delete(clip.id);
    setSources((current) => ({ ...current, [clip.id]: { ...current[clip.id], status: "error", error: message } }));
    job?.reject(new ClipRenderError(message));
  }, []);

  useEffect(() => {
    sourceFailedRef.current = sourceFailed;
  }, [sourceFailed]);

  const setReached = useCallback((reached: Map<string, number>) => {
    setSources((current) => {
      const next = { ...current };
      for (const [id, time] of reached) {
        if (next[id]?.status === "loading") next[id] = { ...next[id], reached: time };
      }
      return next;
    });
  }, []);

  // Clips cut here go out in one request: the server reads the source once
  // for all of them, and early clips arrive long before the read reaches
  // the last one.
  const cutSources = useCallback(
    (items: SourceRequest[], { fresh = false }: { fresh?: boolean } = {}) => {
      for (let i = 0; i < items.length; i += BATCH_MAX) {
        const group = items.slice(i, i + BATCH_MAX);
        const now = Date.now();
        for (const { clip } of group) cutStartedAt.current.set(clip.id, now);
        setSources((current) => {
          const next = { ...current };
          for (const { clip } of group)
            next[clip.id] = { ...next[clip.id], status: "loading", startedAt: now, reached: 0 };
          return next;
        });
        void fetchClipSources(
          project.id,
          group.map(({ from, to }) => ({ start: from, end: to })),
          {
            onReady: (index, source) => void sourceReady(group[index], source),
            onProgress: (time, index) =>
              setReached(
                index === undefined
                  ? new Map(group.map(({ clip }) => [clip.id, time]))
                  : new Map([[group[index].clip.id, time]])
              ),
            onError: (index, message) => sourceFailed(group[index], message),
          },
          abort.current.signal,
          { fresh }
        );
      }
    },
    [project.id, sourceReady, sourceFailed, setReached]
  );

  // Cuts that failed close together are read again together, on a fresh link.
  useEffect(() => {
    retryCut.current = (item) => {
      retryQueue.current.push(item);
      if (retryTimer.current) return;
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        const items = retryQueue.current.splice(0).sort((a, b) => a.from - b.from);
        if (items.length && !abort.current.signal.aborted) cutSources(items, { fresh: true });
      }, SOURCE_RETRY_MS);
    };
  }, [cutSources]);

  // The server cuts every clip ahead as soon as the project is ready
  // (precut.ts). Stored ones download straight from Storage, ones it's still
  // reading towards are waited for (it's ahead of any new read), and only
  // the rest get cut now.
  const loadSources = useCallback(
    async (items: SourceRequest[]) => {
      const signal = abort.current.signal;
      let pending = items;
      while (pending.length && !signal.aborted) {
        const stored = await fetchStoredSources(project.id, signal);
        const waiting: SourceRequest[] = [];
        const missing: SourceRequest[] = [];
        const reached = new Map<string, number>();
        for (const item of pending) {
          const entry = stored?.[item.clip.id];
          if (
            entry?.state === "stored" &&
            Math.abs(entry.from - item.from) < 0.05 &&
            Math.abs(entry.to - item.to) < 0.05
          ) {
            reached.set(item.clip.id, item.from);
            downloadStoredSource(entry, signal).then(
              (source) => void sourceReady(item, source),
              () => {
                if (!signal.aborted) cutSources([item]);
              }
            );
          } else if (entry?.state === "cutting") {
            reached.set(item.clip.id, entry.reached);
            waiting.push(item);
          } else {
            missing.push(item);
          }
        }
        setReached(reached);
        if (missing.length) cutSources(missing);
        pending = waiting;
        if (pending.length) await wait(STORED_POLL_MS, signal);
      }
    },
    [project.id, sourceReady, cutSources, setReached]
  );

  // Every clip requested in the same tick is looked up (and cut) together.
  const flushBatch = useCallback(() => {
    batchScheduled.current = false;
    const items = batch.current.splice(0).sort((a, b) => a.from - b.from);
    if (items.length) void loadSources(items);
  }, [loadSources]);

  /** The clip's cut of the source, fetching it (queued) the first time. */
  const requestSource = useCallback(
    (clip: ClipMoment): Promise<ClipSource> => {
      const existing = sourceJobs.current.get(clip.id);
      if (existing) return existing.promise;

      const job = deferred<ClipSource>();
      sourceJobs.current.set(clip.id, job);
      const { from, to } = clipSourceRange(clip, project.durationSeconds);
      setSources((current) => ({ ...current, [clip.id]: { status: "loading", from, to, startedAt: Date.now() } }));
      batch.current.push({ clip, from, to });
      if (!batchScheduled.current) {
        batchScheduled.current = true;
        queueMicrotask(flushBatch);
      }
      return job.promise;
    },
    [project.durationSeconds, flushBatch]
  );

  const retrySource = useCallback((clip: ClipMoment) => void requestSource(clip), [requestSource]);

  /** Drops the clip's cut and cuts it again from a fresh link to the source, skipping any stored cut. */
  const recutSource = useCallback(
    (clip: ClipMoment): Promise<ClipSource> => {
      const job = deferred<ClipSource>();
      sourceJobs.current.set(clip.id, job);
      sourceTries.current.delete(clip.id);
      const { from, to } = clipSourceRange(clip, project.durationSeconds);
      cutSources([{ clip, from, to }], { fresh: true });
      return job.promise;
    },
    [project.durationSeconds, cutSources]
  );

  /**
   * A render that failed, tried again cheapest fix first. No sound: the
   * project's mp3 in place of the cut's audio (a fresh cut of a source whose
   * merge lost the audio would be just as silent). Anything else, or the mp3
   * didn't do it: a fresh cut from a fresh link, which gets its sound checked
   * like any cut, rendered once more. Throws if that fails too.
   */
  const recover = useCallback(
    async (
      clip: ClipMoment,
      source: ClipSource,
      error: ClipRenderError,
      render: (from: ClipSource) => ReturnType<typeof exportClip>,
      setPreparing: (preparing: boolean) => void
    ) => {
      const signal = abort.current.signal;
      if (error instanceof ClipAudioError) {
        console.warn(`[clips] ${clip.id} rendered without sound; using the project's audio`);
        try {
          setPreparing(true);
          const { from, to } = clipSourceRange(clip, project.durationSeconds);
          const fixed = await withClipAudio(source, await fetchClipAudio(project.id, from, to, signal));
          setPreparing(false);
          return await render(fixed);
        } catch (next) {
          if (signal.aborted || (next instanceof ClipRenderError && next.fatal)) throw next;
          console.warn("[clips] the project's audio didn't fix it; cutting the clip fresh:", next);
        }
      } else {
        console.warn(`[clips] rendering ${clip.id} failed (${error.message}); cutting it fresh`);
      }
      setPreparing(true);
      const fresh = await recutSource(clip);
      setPreparing(false);
      return render(fresh);
    },
    [project.id, project.durationSeconds, recutSource]
  );

  /** Uploads one of a server render's inputs (once per content) and returns its Storage path. */
  const uploadRenderInput = useCallback(
    async (file: { kind: "track"; clipId: string } | { kind: "background" }, bytes: Uint8Array, contentType: string) => {
      const hash = await sha256Hex(bytes);
      const key = `${file.kind}:${file.kind === "track" ? file.clipId : ""}:${hash}`;
      let upload = inputUploads.current.get(key);
      if (!upload) {
        upload = (async () => {
          const response = await fetch(`/api/clips/${project.id}/render-uploads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: [{ ...file, hash, sizeBytes: bytes.byteLength }] }),
          });
          const data = (await response.json().catch(() => null)) as {
            uploads?: { path: string; exists: boolean; token?: string }[];
          } | null;
          const target = data?.uploads?.[0];
          if (!response.ok || !target) throw new Error(`Preparing the render failed (${response.status})`);
          if (!target.exists) {
            const { error } = await createBrowserClient()
              .storage.from("clip-exports")
              .uploadToSignedUrl(target.path, target.token!, new Blob([bytes as BlobPart], { type: contentType }), {
                contentType,
              });
            if (error) throw new Error(`Uploading the render's ${file.kind} failed: ${error.message}`);
          }
          return target.path;
        })();
        upload.catch(() => inputUploads.current.delete(key));
        inputUploads.current.set(key, upload);
      }
      return upload;
    },
    [project.id]
  );

  /**
   * Hands clips to the render worker (they render on Verlab's servers and
   * keep going if the tab closes). Returns the clips it didn't take: the
   * server is off or has no worker up, or a clip's inputs couldn't be
   * prepared. Those render in this tab, as before.
   */
  const renderOnServer = useCallback(
    async (
      targets: ClipMoment[],
      tokens: Map<string, number>,
      settingsOf: (clip: ClipMoment) => ClipEditSettings,
      signal: AbortSignal
    ): Promise<ClipMoment[]> => {
      if (!(await serverTakesRenders(project.id))) return targets;
      const items: ClipRenderRequest[] = [];
      const here: ClipMoment[] = [];
      await Promise.all(
        targets.map(async (clip) => {
          const token = tokens.get(clip.id)!;
          if (!isCurrentRender(project.id, clip.id, token)) return;
          updateRender(project.id, clip.id, token, { preparing: true });
          const settings = settingsOf(clip);
          try {
            // The worker frames the clip with this editor's face track, so the
            // render shows what the preview showed (and the server never re-tracks).
            let trackPath: string | null = null;
            if (usesTracking(settings)) {
              await requestSource(clip).catch(() => null);
              const track = await (trackJobs.current.get(clip.id)?.promise.catch(() => null) ?? null);
              if (track) {
                trackPath = await uploadRenderInput(
                  { kind: "track", clipId: clip.id },
                  await encodeTrack(track),
                  "application/octet-stream"
                );
              }
            }
            const bottom = settings.bottomVideo ? (backgroundRef.current?.file ?? null) : null;
            const backgroundPath = bottom
              ? await uploadRenderInput({ kind: "background" }, new Uint8Array(await bottom.arrayBuffer()), "video/mp4")
              : null;
            items.push({ clipId: clip.id, settings, trackPath, backgroundPath });
          } catch (error) {
            console.warn(`[clips] preparing ${clip.id} for the server failed; rendering it here:`, error);
            here.push(clip);
          }
        })
      );
      if (signal.aborted || !items.length) return here;

      try {
        const response = await fetch(`/api/clips/${project.id}/renders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        const data = (await response.json().catch(() => null)) as { jobs?: ClipRenderJob[] } | null;
        if (!response.ok || !data?.jobs) {
          // Switched off or no worker since the check: render them all here.
          serverChecks.delete(project.id);
          return targets;
        }
        adoptServerRenders(project.id, tokens, data.jobs);
        const taken = new Set(data.jobs.map((job) => job.clipId));
        return targets.filter((clip) => !taken.has(clip.id));
      } catch {
        return targets;
      }
    },
    [project.id, requestSource, uploadRenderInput]
  );

  /**
   * Renders each clip and saves it to the library: on the render worker when
   * it's up, else here (one encoder at a time, across projects). Both keep
   * going if the page is left; a server render keeps going if the tab closes.
   * `browserOnly` skips the server (a server render that failed for good).
   */
  const exportClips = useCallback(
    async (ids: string[], { browserOnly = false }: { browserOnly?: boolean } = {}) => {
      const targets = ids.map((id) => clips.find((clip) => clip.id === id)).filter((c): c is ClipMoment => Boolean(c));
      if (!targets.length) return;
      const settingsOf = (clip: ClipMoment) =>
        settingsRef.current[clip.id] ?? getRender(project.id, clip.id)?.settings ?? defaultsFor(clip);
      const tokens = queueRenders(
        project.id,
        { title: project.title, thumbnailUrl: project.thumbnailUrl },
        targets.map((clip) => ({ clip, settings: settingsOf(clip) }))
      );
      const signal = abort.current.signal;
      exportsPending.current += 1;

      try {
        const local = browserOnly ? targets : await renderOnServer(targets, tokens, settingsOf, signal);
        if (!local.length || signal.aborted) return;
        // Every clip's cut is asked for now, in one tick: one read of the source
        // serves them all, and each clip's cut and face tracking get ready
        // while the clips ahead of it render, instead of only once its turn comes.
        for (const clip of local) void requestSource(clip);

        await runInQueue(async () => {
          for (const clip of local) {
            const token = tokens.get(clip.id)!;
            // Queued again since (Try again, or a second export): that one renders it.
            if (signal.aborted || !isCurrentRender(project.id, clip.id, token)) continue;
            const update = (patch: Parameters<typeof updateRender>[3]) => updateRender(project.id, clip.id, token, patch);
            const clipSettings = settingsOf(clip);
            try {
              update({ preparing: true, settings: clipSettings });
              // Its reads are already retried on fresh links (see sourceFailed).
              const source = await requestSource(clip);
              // A reframe that failed just falls back to a centered Fill.
              const track = usesTracking(clipSettings)
                ? await (trackJobs.current.get(clip.id)?.promise.catch(() => null) ?? null)
                : null;
              update({ status: "rendering", progress: 0, preparing: false });
              const render = (from: ClipSource) =>
                exportClip({
                  source: from,
                  settings: clipSettings,
                  words: project.transcript ?? [],
                  clip,
                  track,
                  background: clipSettings.bottomVideo ? (backgroundRef.current?.file ?? null) : null,
                  signal,
                  onProgress: (progress) => update({ progress }),
                });
              let result: Awaited<ReturnType<typeof exportClip>>;
              try {
                result = await render(source);
              } catch (error) {
                if (signal.aborted || !(error instanceof ClipRenderError) || error.fatal) throw error;
                result = await recover(clip, source, error, render, (preparing) =>
                  update({ preparing, progress: 0 })
                );
              }
              // The queue owns this URL (the Download step and Your clips both use it).
              const url = URL.createObjectURL(result.blob);
              const tooLarge = result.blob.size > CLIP_EXPORT_MAX_BYTES;
              update({
                status: "done",
                progress: 1,
                url,
                size: result.blob.size,
                duration: result.duration,
                saved: tooLarge ? "too-large" : "saving",
              });
              if (!tooLarge) {
                saveWithRetries(project.id, clip, clipSettings, result.blob, result.duration)
                  // Refresh the lists first, so Your clips swaps the live tile for the saved one without a gap.
                  .then(() => Promise.all([mutate(exportsKey(project.id)), mutate("/api/clips/exports")]).catch(() => {}))
                  .then(() => update({ saved: "saved" }))
                  .catch((error) => {
                    console.error("[clips] saving to library failed:", error);
                    update({ saved: "failed" });
                  });
              }
            } catch (error) {
              if (signal.aborted) continue;
              const message = error instanceof Error && error.message ? error.message : "We couldn't render this clip.";
              update({ status: "error", progress: 0, preparing: false, error: message });
            }
          }
        });
      } finally {
        exportsPending.current -= 1;
        if (exportsPending.current === 0 && cleanupLater.current) {
          cleanupLater.current();
          cleanupLater.current = null;
        }
      }
    },
    [
      clips,
      project.id,
      project.title,
      project.thumbnailUrl,
      project.transcript,
      requestSource,
      recover,
      defaultsFor,
      renderOnServer,
    ]
  );

  // A server render that fails for good while this editor is open renders here instead.
  const exportClipsRef = useRef(exportClips);
  useEffect(() => {
    exportClipsRef.current = exportClips;
  }, [exportClips]);
  useEffect(
    () => onServerRenderFailure(project.id, (clipId) => void exportClipsRef.current([clipId], { browserOnly: true })),
    [project.id]
  );

  return {
    settingsFor,
    updateSettings,
    applyStyleToAll,
    sources,
    requestSource,
    retrySource,
    tracks,
    background,
    setBackground,
    renders,
    exportClips,
    serverRenders,
  };
}

export type ClipWorkspace = ReturnType<typeof useClipWorkspace>;
