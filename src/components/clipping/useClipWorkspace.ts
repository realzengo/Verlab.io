"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mutate } from "swr";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  ClipRenderError,
  exportClip,
  fetchClipSources,
  isRtlClip,
  usesTracking,
  wordKey,
  type ClipEditSettings,
  type ClipSource,
} from "@/lib/client/clip-render";
import { analyzeReframe, type ReframeTrack } from "@/lib/client/clip-reframe";
import { ALL_LAYOUTS } from "@/lib/client/clip-layouts";
import {
  CLIP_EXPORT_MAX_BYTES,
  clipSourceRange,
  type ClipMoment,
  type ClipProject,
  type ClipStoredSource,
} from "@/lib/clips";
import {
  getRender,
  isCurrentRender,
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

/** A clip's starting settings; an Arabic one (`rtl`) captions and titles in Montserrat Arabic. */
export function defaultSettings(clip: ClipMoment, rtl = false): ClipEditSettings {
  // The hook starts with up to two of the clip's keywords highlighted.
  const keywords = new Set((clip.keywords ?? []).map(wordKey));
  const hookWords = (clip.hookTitle ?? "").split(/\s+/).map(wordKey);
  return {
    start: clip.start,
    end: clip.end,
    aspect: "9:16",
    // Auto: the AI reads the footage and picks the layout, until the user picks one.
    layouts: [...ALL_LAYOUTS],
    bottomVideo: false,
    reframe: "auto",
    camera: "smooth",
    zoom: "auto",
    focusX: 0.5,
    captions: "hormozi",
    // Auto: the middle on gameplay, screen and split clips, low on the rest.
    captionPosition: "auto",
    captionX: 0.5,
    captionY: 0.72,
    captionFont: rtl ? "arabic" : "auto",
    captionSize: 1,
    captionWords: 0,
    captionColor: "auto",
    emojis: true,
    hookTitle: Boolean(clip.hookTitle),
    hookText: clip.hookTitle ?? "",
    hookStyle: "card",
    hookFont: rtl ? "arabic" : "sauce",
    hookSize: 1,
    hookPosition: "top",
    hookX: 0.5,
    hookY: 0.17,
    hookEmphasis: [...new Set(hookWords.filter((word) => word && keywords.has(word)))].slice(0, 2),
    hookColor: "auto",
    hookMotion: "pop",
    hookUpper: false,
    hookSeconds: 3,
    removePauses: false,
    title: clip.title,
  };
}

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
  if (!prepare.ok || !prepared?.exportId || !prepared.path || !prepared.token) throw new Error("prepare failed");

  const { error } = await createBrowserClient()
    .storage.from("clip-exports")
    .uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: "video/mp4" });
  if (error) throw error;

  const confirm = await fetch(exportsKey(projectId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...meta, exportId: prepared.exportId }),
  });
  if (!confirm.ok) throw new Error("confirm failed");
}

export function useClipWorkspace(project: ClipProject) {
  const [settings, setSettings] = useState<Record<string, ClipEditSettings>>({});
  const [sources, setSources] = useState<Record<string, SourceState>>({});
  const [tracks, setTracks] = useState<Record<string, TrackState>>({});
  const [background, setBackgroundState] = useState<BackgroundVideo | null>(null);

  // Read by exportClips, which runs across many renders.
  const settingsRef = useRef(settings);
  const backgroundRef = useRef(background);
  useEffect(() => {
    settingsRef.current = settings;
    backgroundRef.current = background;
  }, [settings, background]);
  const sourceJobs = useRef(new Map<string, Deferred<ClipSource>>());
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
  // Clips spoken in Arabic (in Arabic script; Darija comes romanized) start in the Arabic font.
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

  const sourceReady = useCallback(
    ({ clip, from, to }: SourceRequest, source: ClipSource) => {
      const url = URL.createObjectURL(source.blob);
      urls.current.add(url);
      setSources((current) => ({ ...current, [clip.id]: { ...current[clip.id], status: "ready", source, url } }));
      sourceJobs.current.get(clip.id)?.resolve(source);
      startTrack(clip, source, from, to);
    },
    [startTrack]
  );

  const sourceFailed = useCallback((clip: ClipMoment, message: string) => {
    const job = sourceJobs.current.get(clip.id);
    sourceJobs.current.delete(clip.id);
    setSources((current) => ({ ...current, [clip.id]: { ...current[clip.id], status: "error", error: message } }));
    job?.reject(new ClipRenderError(message));
  }, []);

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
    (items: SourceRequest[]) => {
      for (let i = 0; i < items.length; i += BATCH_MAX) {
        const group = items.slice(i, i + BATCH_MAX);
        const now = Date.now();
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
            onReady: (index, source) => sourceReady(group[index], source),
            onProgress: (time) => setReached(new Map(group.map(({ clip }) => [clip.id, time]))),
            onError: (index, message) => sourceFailed(group[index].clip, message),
          },
          abort.current.signal
        );
      }
    },
    [project.id, sourceReady, sourceFailed, setReached]
  );

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
              (source) => sourceReady(item, source),
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

  /**
   * Queues each clip's render (one encoder at a time, across projects), then
   * saves it to the library. Keeps running if the page is left.
   */
  const exportClips = useCallback(
    async (ids: string[]) => {
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
        await runInQueue(async () => {
          for (const clip of targets) {
            const token = tokens.get(clip.id)!;
            // Queued again since (Try again, or a second export): that one renders it.
            if (signal.aborted || !isCurrentRender(project.id, clip.id, token)) continue;
            const update = (patch: Parameters<typeof updateRender>[3]) => updateRender(project.id, clip.id, token, patch);
            const clipSettings = settingsOf(clip);
            try {
              update({ preparing: true, settings: clipSettings });
              const source = await requestSource(clip);
              // A reframe that failed just falls back to a centered Fill.
              const track = usesTracking(clipSettings)
                ? await (trackJobs.current.get(clip.id)?.promise.catch(() => null) ?? null)
                : null;
              update({ status: "rendering", progress: 0, preparing: false });
              const result = await exportClip({
                source,
                settings: clipSettings,
                words: project.transcript ?? [],
                clip,
                track,
                background: clipSettings.bottomVideo ? (backgroundRef.current?.file ?? null) : null,
                signal,
                onProgress: (progress) => update({ progress }),
              });
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
                saveToLibrary(project.id, clip, clipSettings, result.blob, result.duration)
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
    [clips, project.id, project.title, project.thumbnailUrl, project.transcript, requestSource, defaultsFor]
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
  };
}

export type ClipWorkspace = ReturnType<typeof useClipWorkspace>;
