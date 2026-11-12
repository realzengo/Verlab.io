import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundUser } from "@/lib/server/credits";
import { fetchDownloadLink, humanizeVideoProviderError, VideoProviderError } from "@/lib/server/video-provider";
import { getTranscription, startTranscription } from "@/lib/server/clips/transcribe";
import { ClipMomentsError, findViralMoments } from "@/lib/server/clips/moments";
import { romanizeClip, romanizeDarija } from "@/lib/server/clips/darija";
import { mediaFormatFor } from "@/lib/server/clips/cut-source";
import { precutClipSources, withoutCut, type StoredClipMoment } from "@/lib/server/clips/precut";
import { MCP_PUBLIC_ORIGIN } from "@/lib/server/mcp/links";
import {
  normalizeClipOptions,
  type ClipProject,
  type ClipProjectStatus,
  type TranscriptWord,
} from "@/lib/clips";

// A clip project moves queued -> transcribing -> finding -> ready | failed,
// on the server whether or not anyone has the page open:
// - the create request fetches the audio and starts WhisperX in after();
// - Replicate's webhook (/api/webhooks/replicate) advances the project the
//   moment the transcript is done, running the moment-finding LLM in after();
// - /api/cron/clips-poll sweeps every working project as the backstop for a
//   missed webhook, a dead after() and the stale-state timeouts below;
// - the page's poll (GET /api/clips/[id]) and the MCP status check advance it
//   too, which is the only path in local dev (Replicate can't reach localhost).
// Each transition is a conditional update on the current status, so
// concurrent callers can't both run the LLM or both refund. Becoming ready
// starts the clips' pre-cut (precut.ts) in after().

export const CLIP_PROJECT_COLUMNS =
  "id, user_id, source_url, video_id, title, channel_title, thumbnail_url, duration_seconds, status, options, credits_charged, prediction_id, media_url, clips, error_message, created_at, updated_at";

/** A stored word: [start, end, word as transcribed, its caption spelling when that differs (Latin Darija)]. */
export type StoredTranscriptWord = [number, number, string, string?];

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
  clips: StoredClipMoment[] | null;
  transcript?: StoredTranscriptWord[] | null;
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
    // The cut state is the server's (GET /api/clips/[id]/sources reports it).
    clips: row.clips?.map(withoutCut) ?? null,
    // The editor captions with each word's caption spelling.
    ...(row.transcript !== undefined
      ? { transcript: row.transcript?.map(([start, end, word, caption]) => [start, end, caption ?? word]) ?? null }
      : {}),
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

const QUEUED_STALE_MS = 5 * 60_000;
// Longer than the poll route's own 300s limit, so a live LLM pass is never re-claimed.
const FINDING_STALE_MS = 6 * 60_000;
const TRANSCRIBING_TIMEOUT_MS = 45 * 60_000;
// Every caller of advanceClipProject runs in a 300s function and calls it
// first thing; the pre-cut that follows a ready project stops reading this
// long after that, leaving time to store what it has.
const PRECUT_BUDGET_MS = 260_000;

const GENERIC_ERROR = "Something went wrong while processing that video. Your credits were refunded.";

// WhisperX downloads the audio from the provider's file servers, which now
// and then drop the connection or time out mid-download ("Input validation
// error: Connection broken: IncompleteRead", "Read timed out"). That isn't
// the video's fault: the project goes back to queued for a fresh audio link
// and a new transcription, up to this many tries in all.
const TRANSCRIBE_ATTEMPTS = 3;
const DOWNLOAD_FAILURE = /input validation error|connection broken|incompleteread|timed out|connectionpool|connection reset/i;
// Replicate's callback for a retried transcription (https only; local dev polls).
const RETRY_WEBHOOK_URL = MCP_PUBLIC_ORIGIN.startsWith("https://")
  ? `${MCP_PUBLIC_ORIGIN}/api/webhooks/replicate`
  : undefined;

const transcribeAttempts = (row: Pick<ClipProjectRow, "options">) => {
  const value = (row.options as { transcribeAttempts?: unknown } | null)?.transcribeAttempts;
  return typeof value === "number" ? value : 1;
};

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

/**
 * Runs right after the create request: audio + video links, then WhisperX.
 * `webhookUrl` is the https Replicate callback; without it (local dev) the
 * project only moves on when something polls it.
 */
export async function prepareClipProject(projectId: string, webhookUrl?: string): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("clip_projects")
    .select(CLIP_PROJECT_COLUMNS)
    .eq("id", projectId)
    .maybeSingle<ClipProjectRow>();
  if (!row || row.status !== "queued") return;

  // The video link is only needed once clips get cut, so WhisperX starts as
  // soon as the audio is ready instead of waiting on both jobs. A retried
  // transcription keeps the link it already has.
  const videoLink = row.media_url
    ? Promise.resolve(null)
    : fetchDownloadLink(row.source_url, mediaFormatFor(row.duration_seconds)).then(
        (video) => video.directUrl,
        (error) => {
          // Not fatal: the clip cutter fetches a fresh link when this is empty.
          console.error("[clips] video link failed, will retry on first cut:", error);
          return null;
        }
      );

  try {
    const audio = await fetchDownloadLink(row.source_url, "mp3");
    const predictionId = await startTranscription(audio.directUrl, webhookUrl);
    await admin
      .from("clip_projects")
      .update({ status: "transcribing", prediction_id: predictionId })
      .eq("id", row.id)
      .eq("status", "queued");
  } catch (error) {
    console.error("[clips] prepare failed:", error);
    await failProject(admin, row, describeError(error));
    return;
  }

  const mediaUrl = await videoLink;
  if (mediaUrl) {
    await admin.from("clip_projects").update({ media_url: mediaUrl }).eq("id", row.id).is("media_url", null);
  }
}

async function findMoments(
  admin: SupabaseClient,
  row: ClipProjectRow,
  words: TranscriptWord[],
  precutDeadline: number
): Promise<ClipProjectRow> {
  try {
    const found = await findViralMoments({
      title: row.title,
      channelTitle: row.channel_title,
      durationSeconds: row.duration_seconds,
      words,
      options: normalizeClipOptions(row.options),
    });
    let clips = found.clips;
    let romanized: { transcript: StoredTranscriptWord[]; language: string } | null = null;
    if (found.darija) {
      // Darija captions in Latin letters; the Arabic-script words are kept beside them.
      const latin = await romanizeDarija(words, clips);
      clips = clips.map((clip) => romanizeClip(clip, words, latin));
      romanized = {
        transcript: words.map((w, i) => (latin.has(i) ? [w[0], w[1], w[2], latin.get(i)] : w)),
        language: "ar-MA",
      };
    }
    const { data: ready } = await admin
      .from("clip_projects")
      .update({ status: "ready", clips, ...romanized })
      .eq("id", row.id)
      .eq("status", "finding")
      .select(CLIP_PROJECT_COLUMNS)
      .maybeSingle<ClipProjectRow>();
    if (!ready) return row;
    after(() =>
      precutClipSources(ready, precutDeadline).catch((error) => console.error("[clips] pre-cut failed:", error))
    );
    return ready;
  } catch (error) {
    console.error("[clips] moment finding failed:", error);
    return failProject(admin, row, describeError(error));
  }
}

/** Advances a working project one step, if its next step is ready. */
export async function advanceClipProject(row: ClipProjectRow): Promise<ClipProjectRow> {
  const admin = createAdminClient();
  const precutDeadline = Date.now() + PRECUT_BUDGET_MS;

  if (row.status === "queued") {
    return ageMs(row) > QUEUED_STALE_MS ? failProject(admin, row, GENERIC_ERROR) : row;
  }

  if (row.status === "transcribing" && row.prediction_id) {
    const state = await getTranscription(row.prediction_id);
    if (state.status === "running") {
      return ageMs(row) > TRANSCRIBING_TIMEOUT_MS ? failProject(admin, row, GENERIC_ERROR) : row;
    }
    if (state.status === "failed") {
      const attempts = transcribeAttempts(row);
      console.error(`[clips] transcription failed (try ${attempts} of ${TRANSCRIBE_ATTEMPTS}):`, state.error);
      if (DOWNLOAD_FAILURE.test(state.error) && attempts < TRANSCRIBE_ATTEMPTS) {
        // Back to queued, once (conditional on this prediction), for a fresh audio link.
        const { data: requeued } = await admin
          .from("clip_projects")
          .update({
            status: "queued",
            prediction_id: null,
            options: { ...((row.options as object | null) ?? {}), transcribeAttempts: attempts + 1 },
          })
          .eq("id", row.id)
          .eq("status", "transcribing")
          .eq("prediction_id", row.prediction_id)
          .select(CLIP_PROJECT_COLUMNS)
          .maybeSingle<ClipProjectRow>();
        if (!requeued) return row;
        after(() => prepareClipProject(requeued.id, RETRY_WEBHOOK_URL));
        return requeued;
      }
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
    return findMoments(admin, claimed, state.words, precutDeadline);
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
    return findMoments(
      admin,
      reclaimed,
      reclaimed.transcript.map(([start, end, word]) => [start, end, word]),
      precutDeadline
    );
  }

  return row;
}

/**
 * Advances a project for a caller that can't wait on the moment-finding pass
 * (~70s for an hour of transcript). Whatever isn't done within `budgetMs`
 * keeps running in after(), and the row is re-read so the caller sees the
 * step the project has reached ("finding" while the LLM runs).
 */
export async function advanceClipProjectWithin(row: ClipProjectRow, budgetMs: number): Promise<ClipProjectRow> {
  const advancing = advanceClipProject(row).catch((error) => {
    // A failed status check (Replicate blip) just means "still working";
    // the next caller tries again.
    console.error("[clips] advance failed:", error);
    return row;
  });
  after(() => advancing.then(() => undefined));

  let timer: ReturnType<typeof setTimeout> | undefined;
  const done = await Promise.race([
    advancing,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), budgetMs);
    }),
  ]);
  clearTimeout(timer);
  if (done) return done;

  const { data: latest } = await createAdminClient()
    .from("clip_projects")
    .select(CLIP_PROJECT_COLUMNS)
    .eq("id", row.id)
    .maybeSingle<ClipProjectRow>();
  return latest ?? row;
}

/** The webhook's hop: the project whose transcription just finished, if it's still working. */
export async function advanceClipProjectForPrediction(predictionId: string): Promise<void> {
  const { data: row } = await createAdminClient()
    .from("clip_projects")
    .select(CLIP_PROJECT_COLUMNS)
    .eq("prediction_id", predictionId)
    .maybeSingle<ClipProjectRow>();
  if (row?.status !== "transcribing") return;
  after(() => advanceClipProject(row).catch((error) => console.error("[clips] webhook advance failed:", error)));
}

/** The cron sweep: one step for every project still working. */
export async function advanceWorkingClipProjects(): Promise<number> {
  const { data: rows, error } = await createAdminClient()
    .from("clip_projects")
    .select(CLIP_PROJECT_COLUMNS)
    .in("status", ["queued", "transcribing", "finding"])
    .returns<ClipProjectRow[]>();
  if (error) throw error;

  await Promise.all(
    (rows ?? []).map((row) =>
      advanceClipProject(row).catch((error) => console.error(`[clips] sweep failed for ${row.id}:`, error))
    )
  );
  return rows?.length ?? 0;
}
