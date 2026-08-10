"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { TrendingVideo } from "@/lib/types";

interface SavedVideosContextValue {
  isSaved: (videoId: string) => boolean;
  toggleSave: (video: TrendingVideo) => void;
}

const SavedVideosContext = createContext<SavedVideosContextValue | null>(null);

// Scoped around the Niche Finder tree (not the whole app) since that's the
// only place video cards render today — TrendingVideoCard appears in both
// the main grid and the detail modal's "related videos" strip, and both
// need to reflect the same persisted save state, not two independent toggles.
export function SavedVideosProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // Guards against a fast double-click firing two conflicting
  // save/unsave requests for the same video before the first resolves.
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/saved-videos", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { videos: { id: string }[] } | null) => {
        if (data) setSavedIds(new Set(data.videos.map((v) => v.id)));
      })
      .catch(() => {
        // Not authenticated, or a transient failure — cards just fall back
        // to "not saved" rather than blocking the page on this.
      });
    return () => controller.abort();
  }, []);

  const toggleSave = useCallback((video: TrendingVideo) => {
    if (pendingRef.current.has(video.id)) return;
    pendingRef.current.add(video.id);

    // Determined inside the functional update so this always acts on the
    // latest state, not a value captured when the callback was created.
    let nextSaved = false;
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(video.id)) {
        next.delete(video.id);
        nextSaved = false;
      } else {
        next.add(video.id);
        nextSaved = true;
      }
      return next;
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
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (nextSaved) next.delete(video.id);
          else next.add(video.id);
          return next;
        });
      })
      .finally(() => {
        pendingRef.current.delete(video.id);
      });
  }, []);

  const isSaved = useCallback((videoId: string) => savedIds.has(videoId), [savedIds]);

  return <SavedVideosContext.Provider value={{ isSaved, toggleSave }}>{children}</SavedVideosContext.Provider>;
}

export function useSavedVideos(): SavedVideosContextValue {
  const ctx = useContext(SavedVideosContext);
  if (!ctx) throw new Error("useSavedVideos must be used within a SavedVideosProvider");
  return ctx;
}
