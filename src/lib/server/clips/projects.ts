import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundUser } from "@/lib/server/credits";
import { fetchDownloadLink, humanizeVideoProviderError, VideoProviderError } from "@/lib/server/video-provider";
import { getTranscription, startTranscription } from "@/lib/server/clips/transcribe";
import { ClipMomentsError, findViralMoments } from "@/lib/server/clips/moments";
import {
  normalizeClipOptions,
  type ClipMoment,
  type ClipProject,
  type ClipProjectStatus,
  type TranscriptWord,
} from "@/lib/clips";

// A clip project moves queued -> transcribing -> finding -> ready | failed.
// Nothing runs in the background past the create request except the first
// hop (fetching audio and starting WhisperX, in after()); every later hop
// happens when the browser polls GET /api/clips/[id], which calls
// advanceClipProject. Each transition is a conditional update on the current
// status, so concurrent polls can't both run the LLM or both refund.

export const CLIP_PROJECT_COLUMNS =
  "id, user_id, source_url, video_id, title, channel_title, thumbnail_url, duration_seconds, status, options, credits_charged, prediction_id, media_url, clips, error_message, created_at, updated_at";

export interface ClipProjectRow {
  id: string;
  user_id: string;
  source_url: string;
  video_id: string;
  title: string;
  channel_title: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  status: ClipProjectStatus;
  options: unknown;
  credits_charged: number;
  prediction_id: string | null;
  media_url: string | null;
  clips: ClipMoment[] | null;
  transcript?: TranscriptWord[] | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function toClipProject(row: ClipProjectRow): ClipProject {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    videoId: row.video_id,
    title: row.title,
    channelTitle: row.channel_title,
    thumbnailUrl: row.thumbnail_url,
    durationSeconds: row.duration_seconds,
    status: row.status,
    options: normalizeClipOptions(row.options),
    clips: row.clips,
    ...(row.transcript !== undefined ? { transcript: row.transcript } : {}),
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

const QUEUED_STALE_MS = 5 * 60_000;
// Longer than the poll route's own 300s limit, so a live LLM pass is never re-claimed.
const FINDING_STALE_MS = 6 * 60_000;
const TRANSCRIBING_TIMEOUT_MS = 45 * 60_000;

const GENERIC_ERROR = "Something went wrong while processing that video. Your credits were refunded.";

/**
 * The provider's stream has no Range support, so cutting a clip means
 * reading the video from the start up to it, at ~2-10 MB/s depending on the
 * provider's server. 1080p is ~2x the bytes of 720p, so only short videos get
 * it; longer ones stay at 720p to keep deep clips inside the cut route's
 * time limit.
 */
export const mediaFormatFor = (durationSeconds: number) => (durationSeconds <= 12 * 60 ? "1080" : "720");

function describeError(error: unknown): string {
  if (error instanceof ClipMomentsError) return `${error.message} Your credits were refunded.`;
  if (error instanceof VideoProviderError) return `${humanizeVideoProviderError(error)} Your credits were refunded.`;
  return GENERIC_ERROR;
}

const ageMs = (row: Pick<ClipProjectRow, "updated_at">) => Date.now() - new Date(row.updated_at).getTime();

/** Moves a still-working project to failed and refunds it, once. */
async function failProject(admin: SupabaseClient, row: ClipProjectRow, message: string): Promise<ClipProjectRow> {
  const { data: failed } = await admin
    .from("clip_projects")
    .update({ status: "failed", error_message: message })
    .eq("id", row.id)
    .in("status", ["queued", "transcribing", "finding"])
    .select(CLIP_PROJECT_COLUMNS)
    .maybeSingle<ClipProjectRow>();

  if (failed && failed.credits_charged > 0) {
    await refundUser(failed.user_id, failed.credits_charged, "Clipping refund", "clipping.analyze");
  }
  return failed ?? { ...row, status: "failed", error_message: message };
}

/** Runs right after the create request: audio + video links, then WhisperX. */
export async function prepareClipProject(projectId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("clip_projects")
    .select(CLIP_PROJECT_COLUMNS)
    .eq("id", projectId)
    .maybeSingle<ClipProjectRow>();
  if (!row || row.status !== "queued") return;

  try {
    const [audio, video] = await Promise.allSettled([
      fetchDownloadLink(row.source_url, "mp3"),
      fetchDownloadLink(row.source_url, mediaFormatFor(row.duration_seconds)),
    ]);
    if (audio.status === "rejected") throw audio.reason;
    if (video.status === "rejected") {
      // Not fatal: the clip cutter fetches a fresh link when this is empty.
      console.error("[clips] video link failed, will retry on first cut:", video.reason);
    }

    const predictionId = await startTranscription(audio.value.directUrl);
    await admin
      .from("clip_projects")
      .update({
        status: "transcribing",
        prediction_id: predictionId,
        media_url: video.status === "fulfilled" ? video.value.directUrl : null,
      })
      .eq("id", row.id)
      .eq("status", "queued");
  } catch (error) {
    console.error("[clips] prepare failed:", error);
    await failProject(admin, row, describeError(error));
  }
}

async function findMoments(
  admin: SupabaseClient,
  row: ClipProjectRow,
  words: TranscriptWord[]
): Promise<ClipProjectRow> {
  try {
    const clips = await findViralMoments({
      title: row.title,
      channelTitle: row.channel_title,
      durationSeconds: row.duration_seconds,
      words,
      options: normalizeClipOptions(row.options),
    });
    const { data: ready } = await admin
      .from("clip_projects")
      .update({ status: "ready", clips })
      .eq("id", row.id)
      .eq("status", "finding")
      .select(CLIP_PROJECT_COLUMNS)
      .maybeSingle<ClipProjectRow>();
    return ready ?? row;
  } catch (error) {
    console.error("[clips] moment finding failed:", error);
    return failProject(admin, row, describeError(error));
  }
}

/** Advances a working project one step, if its next step is ready. */
export async function advanceClipProject(row: ClipProjectRow): Promise<ClipProjectRow> {
  const admin = createAdminClient();

  if (row.status === "queued") {
    return ageMs(row) > QUEUED_STALE_MS ? failProject(admin, row, GENERIC_ERROR) : row;
  }

  if (row.status === "transcribing" && row.prediction_id) {
    const state = await getTranscription(row.prediction_id);
    if (state.status === "running") {
      return ageMs(row) > TRANSCRIBING_TIMEOUT_MS ? failProject(admin, row, GENERIC_ERROR) : row;
    }
    if (state.status === "failed") {
      console.error("[clips] transcription failed:", state.error);
      return failProject(admin, row, GENERIC_ERROR);
    }
    if (!state.words.length) {
      return failProject(admin, row, "We couldn't hear any speech in this video. Your credits were refunded.");
    }
    const { data: claimed } = await admin
      .from("clip_projects")
      .update({ status: "finding", transcript: state.words, language: state.language })
      .eq("id", row.id)
      .eq("status", "transcribing")
      .select(CLIP_PROJECT_COLUMNS)
      .maybeSingle<ClipProjectRow>();
    // Another poll got there first; it's running the LLM.
    if (!claimed) return { ...row, status: "finding" };
    return findMoments(admin, claimed, state.words);
  }

  if (row.status === "finding" && ageMs(row) > FINDING_STALE_MS) {
    // The poll that claimed this died mid-LLM. Re-claim by bumping
    // updated_at against the value we saw, then retry from the stored words.
    const { data: reclaimed } = await admin
      .from("clip_projects")
      .update({ status: "finding" })
      .eq("id", row.id)
      .eq("status", "finding")
      .eq("updated_at", row.updated_at)
      .select(`${CLIP_PROJECT_COLUMNS}, transcript`)
      .maybeSingle<ClipProjectRow>();
    if (!reclaimed) return row;
    if (!reclaimed.transcript?.length) return failProject(admin, reclaimed, GENERIC_ERROR);
    return findMoments(admin, reclaimed, reclaimed.transcript);
  }

  return row;
}

/** A fresh provider link for the source video, saved on the row. */
export async function refreshClipMediaUrl(
  row: Pick<ClipProjectRow, "id" | "source_url" | "duration_seconds">
): Promise<string> {
  const { directUrl } = await fetchDownloadLink(row.source_url, mediaFormatFor(row.duration_seconds));
  await createAdminClient().from("clip_projects").update({ media_url: directUrl }).eq("id", row.id);
  return directUrl;
}
