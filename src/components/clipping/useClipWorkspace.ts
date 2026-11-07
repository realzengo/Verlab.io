"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mutate } from "swr";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  ClipRenderError,
  exportClip,
  fetchClipSources,
  usesTracking,
  wordKey,
  type ClipEditSettings,
  type ClipSource,
} from "@/lib/client/clip-render";
import { analyzeReframe, type ReframeTrack } from "@/lib/client/clip-reframe";
import { CLIP_EXPORT_MAX_BYTES, CLIP_MAX_SECONDS, type ClipMoment, type ClipProject } from "@/lib/clips";

// Everything the Edit and Post steps share for one project: each clip's
// settings, its cut of the source video, its face-tracking path, the split
// screen's background, and its rendered MP4 (saved to the library once
// rendered). Lives above both steps so moving between them keeps the work.

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

// Room to stretch a clip in the editor without fetching again.
const SOURCE_MARGIN_SECONDS = 8;
// Most cuts one request carries (the route's own cap).
const BATCH_MAX = 12;

/** The parts of the settings that are style, not content: "Apply to all" copies these. */
const STYLE_KEYS = [
  "aspect",
  "layouts",
  "bottomVideo",
  "reframe",
  "camera",
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

export function defaultSettings(clip: ClipMoment): ClipEditSettings {
  // The hook starts with up to two of the clip's keywords highlighted.
  const keywords = new Set((clip.keywords ?? []).map(wordKey));
  const hookWords = (clip.hookTitle ?? "").split(/\s+/).map(wordKey);
  return {
    start: clip.start,
    end: clip.end,
    aspect: "9:16",
    layouts: ["fill"],
    bottomVideo: false,
    reframe: "auto",
    camera: "smooth",
    focusX: 0.5,
    captions: "hormozi",
    captionPosition: "bottom",
    captionX: 0.5,
    captionY: 0.72,
    captionFont: "auto",
    captionSize: 1,
    captionWords: 0,
    captionColor: "auto",
    emojis: true,
    hookTitle: Boolean(clip.hookTitle),
    hookText: clip.hookTitle ?? "",
    hookStyle: "card",
    hookFont: "sauce",
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
  const [renders, setRenders] = useState<Record<string, RenderState>>({});
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
  const batch = useRef<{ clip: ClipMoment; from: number; to: number }[]>([]);
  const batchScheduled = useRef(false);
  const trackChain = useRef<Promise<unknown>>(Promise.resolve());
  const abort = useRef(new AbortController());
  const urls = useRef(new Set<string>());
  const exporting = useRef(false);

  // Created here, not at first render: StrictMode's rehearsal unmount would
  // otherwise leave every later request holding an already-aborted signal.
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    const objectUrls = urls.current;
    return () => {
      controller.abort();
      for (const url of objectUrls) URL.revokeObjectURL(url);
      objectUrls.clear();
    };
  }, []);

  const clips = useMemo(() => project.clips ?? [], [project.clips]);
  const settingsFor = useCallback((clip: ClipMoment) => settings[clip.id] ?? defaultSettings(clip), [settings]);

  const updateSettings = useCallback((clip: ClipMoment, patch: Partial<ClipEditSettings>) => {
    setSettings((current) => ({ ...current, [clip.id]: { ...(current[clip.id] ?? defaultSettings(clip)), ...patch } }));
  }, []);

  /** Copies one clip's style (not its title, hook text or trim) to others. */
  const applyStyleToAll = useCallback((from: ClipMoment, targets: ClipMoment[]) => {
    setSettings((current) => {
      const style = current[from.id] ?? defaultSettings(from);
      const next = { ...current };
      for (const clip of targets) {
        if (clip.id === from.id) continue;
        const base = next[clip.id] ?? defaultSettings(clip);
        next[clip.id] = {
          ...base,
          ...Object.fromEntries(
            STYLE_KEYS.map((key) => [key, Array.isArray(style[key]) ? [...style[key]] : style[key]])
          ),
        };
      }
      return next;
    });
  }, []);

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

  // Every clip requested in the same tick goes out in one request: the
  // server reads the source once for all of them, and early clips arrive
  // long before the read reaches the last one.
  const flushBatch = useCallback(() => {
    batchScheduled.current = false;
    const items = batch.current.splice(0).sort((a, b) => a.from - b.from);
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
          onReady: (index, source) => {
            const { clip, from, to } = group[index];
            const url = URL.createObjectURL(source.blob);
            urls.current.add(url);
            setSources((current) => ({ ...current, [clip.id]: { ...current[clip.id], status: "ready", source, url } }));
            sourceJobs.current.get(clip.id)?.resolve(source);
            startTrack(clip, source, from, to);
          },
          onProgress: (time) =>
            setSources((current) => {
              const next = { ...current };
              for (const { clip } of group) {
                if (next[clip.id]?.status === "loading") next[clip.id] = { ...next[clip.id], reached: time };
              }
              return next;
            }),
          onError: (index, message) => {
            const { clip } = group[index];
            const job = sourceJobs.current.get(clip.id);
            sourceJobs.current.delete(clip.id);
            setSources((current) => ({
              ...current,
              [clip.id]: { ...current[clip.id], status: "error", error: message },
            }));
            job?.reject(new ClipRenderError(message));
          },
        },
        abort.current.signal
      );
    }
  }, [project.id, startTrack]);

  /** The clip's cut of the source, fetching it (queued) the first time. */
  const requestSource = useCallback(
    (clip: ClipMoment): Promise<ClipSource> => {
      const existing = sourceJobs.current.get(clip.id);
      if (existing) return existing.promise;

      const job = deferred<ClipSource>();
      sourceJobs.current.set(clip.id, job);
      const from = Math.max(0, clip.start - SOURCE_MARGIN_SECONDS);
      const to = Math.min(project.durationSeconds, clip.end + SOURCE_MARGIN_SECONDS, from + CLIP_MAX_SECONDS);
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

  /** Renders each clip in turn (one encoder at a time), then saves it to the library. */
  const exportClips = useCallback(
    async (ids: string[]) => {
      if (exporting.current) return;
      exporting.current = true;
      const targets = ids.map((id) => clips.find((clip) => clip.id === id)).filter((c): c is ClipMoment => Boolean(c));
      setRenders((current) => {
        const next = { ...current };
        for (const clip of targets) next[clip.id] = { status: "waiting", progress: 0 };
        return next;
      });

      try {
        for (const clip of targets) {
          if (abort.current.signal.aborted) return;
          const clipSettings = settingsRef.current[clip.id] ?? defaultSettings(clip);
          try {
            const source = await requestSource(clip);
            // A reframe that failed just falls back to a centered Fill.
            const track = usesTracking(clipSettings)
              ? await (trackJobs.current.get(clip.id)?.promise.catch(() => null) ?? null)
              : null;
            setRenders((current) => ({ ...current, [clip.id]: { status: "rendering", progress: 0 } }));
            const result = await exportClip({
              source,
              settings: clipSettings,
              words: project.transcript ?? [],
              clip,
              track,
              background: clipSettings.bottomVideo ? (backgroundRef.current?.file ?? null) : null,
              signal: abort.current.signal,
              onProgress: (progress) =>
                setRenders((current) => ({ ...current, [clip.id]: { ...current[clip.id], progress } })),
            });
            const url = URL.createObjectURL(result.blob);
            urls.current.add(url);
            const tooLarge = result.blob.size > CLIP_EXPORT_MAX_BYTES;
            setRenders((current) => ({
              ...current,
              [clip.id]: {
                status: "done",
                progress: 1,
                url,
                size: result.blob.size,
                duration: result.duration,
                saved: tooLarge ? "too-large" : "saving",
              },
            }));
            if (!tooLarge) {
              saveToLibrary(project.id, clip, clipSettings, result.blob, result.duration)
                .then(() => {
                  setRenders((current) => ({ ...current, [clip.id]: { ...current[clip.id], saved: "saved" } }));
                  void mutate(exportsKey(project.id));
                })
                .catch((error) => {
                  console.error("[clips] saving to library failed:", error);
                  setRenders((current) => ({ ...current, [clip.id]: { ...current[clip.id], saved: "failed" } }));
                });
            }
          } catch (error) {
            if (abort.current.signal.aborted) return;
            const message = error instanceof Error && error.message ? error.message : "We couldn't render this clip.";
            setRenders((current) => ({ ...current, [clip.id]: { status: "error", progress: 0, error: message } }));
          }
        }
      } finally {
        exporting.current = false;
      }
    },
    [clips, project.id, project.transcript, requestSource]
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
