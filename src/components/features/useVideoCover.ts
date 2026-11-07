import { useState } from "react";
import type { TrendingVideo } from "@/lib/types";
import { isStoredVideoCover, tiktokCoverProxyUrl } from "@/lib/video-covers";

/**
 * Which image a video's cover <img> should load, stepping to the next one on
 * each load error. src is null once nothing is left, so the caller shows its
 * gradient.
 *
 * A TikTok cover that isn't a stored copy yet is a signed CDN link that may
 * already have expired, so it goes straight to the tiktok-thumb proxy, which
 * copies it into storage (re-fetching it from TikTok if need be) and
 * redirects there. A stored copy that somehow fails gets the proxy as a
 * second try. Callers key their component by video id, so this never needs
 * to reset.
 */
export function useVideoCover(video: Pick<TrendingVideo, "platform" | "coverUrl" | "videoUrl">) {
  const sources =
    video.platform === "tiktok"
      ? [isStoredVideoCover(video.coverUrl) ? video.coverUrl : null, tiktokCoverProxyUrl(video.videoUrl)]
      : [video.coverUrl];
  const candidates = sources.filter((src): src is string => Boolean(src));
  const [attempt, setAttempt] = useState(0);

  return {
    src: candidates[attempt] ?? null,
    onError: () => setAttempt((n) => n + 1),
  };
}
