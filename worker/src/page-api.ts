// The contract between the worker (Node) and its render page (headless
// Chrome). Types only, so both bundles can import it.

import type { ClipEditSettings } from "@/lib/client/clip-render";
import type { ClipEmoji, TranscriptWord } from "@/lib/clips";

/** Bumped when the page's API changes shape, so a stale page bundle is caught at startup. */
export const PAGE_API_VERSION = 1;

/** What the page's Chrome can encode, read once at startup and logged. */
export interface CodecProbe {
  userAgent: string;
  webCodecs: boolean;
  /** H.264 at 1080x1920, the main output. */
  avc1080: boolean;
  /** H.264 at 720x1280, the renderer's fallback size. */
  avc720: boolean;
  avcHardware: boolean;
  aac: boolean;
  opus: boolean;
}

export interface PageRenderInput {
  /** The clip's cut of the source, served by the worker's local file server. */
  sourceUrl: string;
  /** Source time (seconds) at 0 in the cut. */
  offset: number;
  settings: ClipEditSettings;
  words: TranscriptWord[];
  clip: { keywords?: string[]; emojis?: ClipEmoji[] };
  /** Run face tracking over this source range first (null: centered crop, no tracking). */
  track: { from: number; to: number } | null;
  /** The split layout's bottom video, if the clip uses one. */
  backgroundUrl: string | null;
  /** Where the page PUTs the finished MP4. */
  outputUrl: string;
}

export interface PageRenderResult {
  duration: number;
  bytes: number;
  trackMs: number;
  encodeMs: number;
  /** Whether face tracking ran (and fed the layout), or the clip used a centered crop. */
  tracked: boolean;
}

export type PageStage = "tracking" | "encoding";

export interface PageApi {
  version: number;
  probe(): Promise<CodecProbe>;
  render(input: PageRenderInput): Promise<PageRenderResult>;
}

declare global {
  interface Window {
    verlab?: PageApi;
    /** Exposed by the worker: progress from inside the page. */
    verlabProgress?: (stage: PageStage, progress: number) => void;
  }
}
