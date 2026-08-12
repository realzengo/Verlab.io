"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TrendingVideo } from "@/lib/types";

interface SavedVideosContextValue {
  isSaved: (videoId: string) => boolean;
  toggleSave: (video: TrendingVideo) => void;
  /** Full saved-video objects, newest first — backs the "Liked" tab's grid. */
  savedVideos: TrendingVideo[];
  savedVideosLoading: boolean;
}

const SavedVideosContext = createContext<SavedVideosContextValue | null>(null);

// Scoped around the Niche Finder tree (not the whole app) since that's the
// only place video cards render today — TrendingVideoCard appears in both
// the main grid and the detail modal's "related videos" strip, and both
// need to reflect the same persisted save state, not two independent toggles.
export function SavedVideosProvider({ children }: { children: ReactNode }) {
  const [savedVideos, setSavedVideos] = useState<TrendingVideo[]>([]);
  const [savedVideosLoading, setSavedVideosLoading] = useState(true);
  // Guards against a fast double-click firing two conflicting
  // save/unsave requests for the same video before the first resolves.
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/saved-videos", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { videos: TrendingVideo[] } | null) => {
        if (data) setSavedVideos(data.videos);
      })
      .catch(() => {
        // Not authenticated, or a transient failure — cards just fall back
        // to "not saved" rather than blocking the page on this.
      })
      .finally(() => setSavedVideosLoading(false));
    return () => controller.abort();
  }, []);

  const toggleSave = useCallback((video: TrendingVideo) => {
    if (pendingRef.current.has(video.id)) return;
    pendingRef.current.add(video.id);

    // Determined inside the functional update so this always acts on the
    // latest state, not a value captured when the callback was created.
    let nextSaved = false;
    setSavedVideos((prev) => {
      const alreadySaved = prev.some((v) => v.id === video.id);
      if (alreadySaved) {
        nextSaved = false;
        return prev.filter((v) => v.id !== video.id);
      }
      nextSaved = true;
      return [video, ...prev];
    });

    const request = nextSaved
      ? fetch("/api/saved-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(video),
        })
      : fetch(`/api/saved-videos/${encodeURIComponent(video.id)}`, { method: "DELETE" });

    request
      .then((res) => {
        if (!res.ok) throw new Error(`saved-videos request failed (${res.status})`);
      })
      .catch((err) => {
        console.error("[saved-videos] toggle failed, rolling back:", err);
        setSavedVideos((prev) => {
          if (nextSaved) return prev.filter((v) => v.id !== video.id);
          return prev.some((v) => v.id === video.id) ? prev : [video, ...prev];
        });
      })
      .finally(() => {
        pendingRef.current.delete(video.id);
      });
  }, []);

  const savedIds = useMemo(() => new Set(savedVideos.map((v) => v.id)), [savedVideos]);
  const isSaved = useCallback((videoId: string) => savedIds.has(videoId), [savedIds]);

  return (
    <SavedVideosContext.Provider value={{ isSaved, toggleSave, savedVideos, savedVideosLoading }}>
      {children}
    </SavedVideosContext.Provider>
  );
}

export function useSavedVideos(): SavedVideosContextValue {
  const ctx = useContext(SavedVideosContext);
  if (!ctx) throw new Error("useSavedVideos must be used within a SavedVideosProvider");
  return ctx;
}
