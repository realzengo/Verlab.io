// Hands a generated image off to the Video Generator's "Animate" action --
// sessionStorage rather than a URL query param since data URLs (a few MB for
// a 2K/4K image) are well past what's safe to round-trip through a URL
// across browsers/proxies. Mirrors voiceover-handoff.ts's read-once pattern.
export const IMAGE_TO_VIDEO_HANDOFF_KEY = "clypa:image-to-video-handoff";

export interface ImageToVideoHandoff {
  imageDataUrl: string;
}

export function writeImageToVideoHandoff(handoff: ImageToVideoHandoff): void {
  sessionStorage.setItem(IMAGE_TO_VIDEO_HANDOFF_KEY, JSON.stringify(handoff));
}

// Read-once: clears the key immediately so a manual visit to the video
// generator later in the session doesn't unexpectedly reload a stale image.
export function consumeImageToVideoHandoff(): ImageToVideoHandoff | null {
  const raw = sessionStorage.getItem(IMAGE_TO_VIDEO_HANDOFF_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(IMAGE_TO_VIDEO_HANDOFF_KEY);
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.imageDataUrl !== "string") return null;
    return { imageDataUrl: parsed.imageDataUrl };
  } catch {
    return null;
  }
}
