import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDownloadLink } from "@/lib/server/video-provider";
import type { ClipProjectRow } from "@/lib/server/clips/projects";
import { Fmp4CutError, cutFragmentedMp4Ranges, type CutEvent, type CutRange } from "@/lib/server/clips/fmp4-cut";

// Opening the source video for cutting, shared by the editor's on-demand
// cuts (POST /api/clips/[id]/segments) and the server's pre-cut (precut.ts).

/**
 * The provider's stream has no Range support, so cutting a clip means
 * reading the video from the start up to it, at ~2-10 MB/s depending on the
 * provider's server. 1080p is ~2x the bytes of 720p, so only short videos get
 * it; longer ones stay at 720p to keep deep clips inside the cut route's
 * time limit.
 */
export const mediaFormatFor = (durationSeconds: number) => (durationSeconds <= 12 * 60 ? "1080" : "720");

/** A fresh provider link for the source video, saved on the row. */
export async function refreshClipMediaUrl(
  row: Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds">
): Promise<string> {
  const { directUrl } = await fetchDownloadLink(row.source_url, mediaFormatFor(row.duration_seconds));
  await createAdminClient().from("clip_projects").update({ media_url: directUrl }).eq("id", row.id);
  return directUrl;
}

// The keyframe a clip decodes from sits before its first frame.
const LEAD_SECONDS = 1;
const TAIL_SECONDS = 0.5;

// Same browser-like UA the downloads proxy sends; the provider rejects bare fetches.
const UPSTREAM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

/** The source range to read for a clip range: a little lead and tail around it. */
export const paddedCutRange = (range: CutRange): CutRange => ({
  start: Math.max(0, range.start - LEAD_SECONDS),
  end: range.end + TAIL_SECONDS,
});

/** A fresh provider link's stream, skipping the saved one. */
async function openFreshClipSource(
  row: Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds">,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const fresh = await refreshClipMediaUrl(row);
  const response = await fetch(fresh, { headers: UPSTREAM_HEADERS, signal });
  if (!response.ok || !response.body) {
    throw new Error(`Source stream returned ${response.status}`);
  }
  return response.body;
}

/**
 * Cuts `ranges` out of an opened source (see openClipSource). Now and then
 * the provider serves a stream with no audio track (its merge of YouTube's
 * separate audio and video failed), which would cut into silent clips; that
 * stream is dropped before anything is cut and a fresh link is read instead.
 * Should that one come silent too, the cut goes ahead and the editor, which
 * knows whether the clip has speech, refuses the silent render.
 */
export async function cutClipSource(
  row: Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds">,
  source: ReadableStream<Uint8Array>,
  ranges: CutRange[],
  onEvent: (event: CutEvent) => void | Promise<void>,
  signal: AbortSignal
): Promise<void> {
  try {
    await cutFragmentedMp4Ranges(source, ranges, onEvent, { requireAudio: true });
  } catch (error) {
    if (!(error instanceof Fmp4CutError && error.code === "no_audio") || signal.aborted) throw error;
    console.warn(`[clips] source of ${row.id} came without audio; reading a fresh link`);
    await cutFragmentedMp4Ranges(await openFreshClipSource(row, signal), ranges, onEvent);
  }
}

/** The source video's stream, minting a fresh provider link if the saved one has expired. */
export async function openClipSource(
  row: Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds" | "media_url">,
  signal: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  if (row.media_url) {
    const response = await fetch(row.media_url, { headers: UPSTREAM_HEADERS, signal }).catch(() => null);
    if (response?.ok && response.body) return response.body;
    await response?.body?.cancel().catch(() => {});
  }
  // Provider links are short-lived; mint a new one and try once more.
  return openFreshClipSource(row, signal);
}
