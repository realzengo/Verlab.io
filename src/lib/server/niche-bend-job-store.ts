import type { ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import {
  NicheBendAiError,
  conversationHasTranscripts,
  generateSopContent,
  regenerateCandidates,
  regenerateOneCandidate,
  researchChannel,
  researchFromManualVideos,
} from "./niche-bend-ai";
import { backfillAvatarUrl } from "./apify-client";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { InsufficientCreditsError, chargeUser, refundUser } from "@/lib/server/credits";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  NicheBendCandidate,
  NicheBendChannelAnalysis,
  NicheBendJobStatus,
  NicheBendJobStatusResponse,
  NicheBendPlatform,
  NicheBendSopResult,
  NicheBendVideo,
  NicheBendVideoType,
} from "@/lib/types";

type MessageParam = ModelMessage;

// Postgres-backed job store (niche_bend_jobs table) — survives serverless
// cold starts / multiple instances, unlike the in-memory Map this replaced.
// Row updates go through the caller's request-scoped (cookie-based) Supabase
// client so RLS keeps every read/write owner-scoped automatically.

export interface NicheBendJobRow {
  id: string;
  user_id: string;
  source_url: string;
  platform: NicheBendPlatform;
  video_type: NicheBendVideoType;
  manual_videos: NicheBendVideo[] | null;
  status: NicheBendJobStatus;
  error_message: string | null;
  analysis: NicheBendChannelAnalysis | null;
  candidates: NicheBendCandidate[] | null;
  conversation: MessageParam[] | null;
  chosen_bend: NicheBendCandidate | null;
  sop: NicheBendSopResult | null;
  saved: boolean;
}

const JOB_COLUMNS =
  "id, user_id, source_url, platform, video_type, manual_videos, status, error_message, analysis, candidates, conversation, chosen_bend, sop, saved";

interface ResearchCacheEntry {
  analysis: NicheBendChannelAnalysis;
  conversation: MessageParam[];
}

function researchCacheKey(sourceUrl: string, platform: NicheBendPlatform, videoType: NicheBendVideoType): string {
  return `${platform}|${videoType}|${sourceUrl.trim().toLowerCase()}`;
}

// Internal dedup cache is cross-user infra (not RLS'd user data), so it goes
// through the service-role client rather than the caller's session client.
// Best-effort: a cache read/write failure (bad service-role key, transient DB
// error) must never fail the whole analysis — it just means we skip the
// dedup shortcut and do the real research instead. Without this, a hiccup
// here surfaced as a raw, unwrapped error and killed the job with a generic
// "something went wrong" message even though nothing about the channel
// analysis itself was broken.
async function getCachedResearch(cacheKey: string): Promise<ResearchCacheEntry | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("niche_bend_research_cache")
      .select("analysis, conversation")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    return data ? { analysis: data.analysis, conversation: data.conversation } : null;
  } catch (error) {
    console.error("[niche-bend] Research cache read failed, continuing without cache:", error);
    return null;
  }
}

async function setCachedResearch(cacheKey: string, entry: ResearchCacheEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("niche_bend_research_cache").upsert({
      cache_key: cacheKey,
      analysis: entry.analysis,
      conversation: entry.conversation,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[niche-bend] Research cache write failed, continuing:", error);
  }
}

const PHASE_TEXT: Record<NicheBendJobStatus, { statusText: string; progress: number }> = {
  opening_channel: { statusText: "Opening channel…", progress: 10 },
  reading_videos: { statusText: "Reading & transcribing top videos…", progress: 35 },
  identifying_format: { statusText: "Identifying the format…", progress: 60 },
  generating_bends: { statusText: "Generating your niche bends…", progress: 85 },
  ready: { statusText: "Ready", progress: 100 },
  generating_sop: { statusText: "Writing your SOP…", progress: 100 },
  sop_ready: { statusText: "Ready", progress: 100 },
  failed: { statusText: "Something went wrong", progress: 100 },
};

// Deterministic QA hook: a source URL containing "fail" or "error" always
// fails (without spending an API call) so the error UI is reachable on demand.
function isFailureTrigger(sourceUrl: string): boolean {
  const haystack = sourceUrl.toLowerCase();
  return haystack.includes("fail") || haystack.includes("error");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function humanizeError(error: unknown): string {
  if (error instanceof NicheBendAiError) {
    return "We couldn't read that channel. Try again or paste your videos manually.";
  }
  return "Something went wrong while analyzing this channel. Try again or paste your videos manually.";
}

async function updateJob(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Omit<NicheBendJobRow, "id">>
): Promise<void> {
  // supabase-js doesn't throw on query failures — it returns { error } — so
  // this must be checked explicitly. Left unchecked, a failed status write
  // (RLS hiccup, transient DB error) would silently no-op: no exception, so
  // runPipeline's try/catch never fires, and the job sits frozen in its last
  // status forever with no error ever surfaced to the user.
  const { error } = await supabase.from("niche_bend_jobs").update(patch).eq("id", id);
  if (error) {
    throw new Error(`Failed to update niche_bend_jobs (${id}): ${error.message}`);
  }
}

async function runPipeline(supabase: SupabaseClient, job: NicheBendJobRow): Promise<void> {
  // Tracks the charge actually made in whichever branch below runs, so the
  // outer catch can refund exactly that amount/key if the branch's real work
  // then fails -- a charge made before scrapeChannelVideos/researchChannel
  // etc. shouldn't be kept if no value was ever delivered.
  let charged: { amount: number; actionKey: string } | null = null;

  try {
    const hasManualVideos = Boolean(job.manual_videos && job.manual_videos.length > 0);

    if (!hasManualVideos && isFailureTrigger(job.source_url)) {
      await sleep(1500);
      await updateJob(supabase, job.id, {
        status: "failed",
        error_message: "We couldn't read that channel. Try again or paste your videos manually.",
      });
      return;
    }

    if (hasManualVideos) {
      await updateJob(supabase, job.id, { status: "identifying_format" });
      try {
        await chargeUser(
          job.user_id,
          TOOL_CREDIT_COSTS.nicheBend.analyzeManualVideos,
          "Niche Bend Analysis (manual videos)",
          "niche_bend.analyze_manual_videos"
        );
        charged = { amount: TOOL_CREDIT_COSTS.nicheBend.analyzeManualVideos, actionKey: "niche_bend.analyze_manual_videos" };
      } catch (creditError) {
        if (creditError instanceof InsufficientCreditsError) {
          await updateJob(supabase, job.id, { status: "failed", error_message: "Insufficient credits" });
          return;
        }
        console.error("[credits] Charge failed, proceeding without charge:", creditError);
      }
      const outcome = await researchFromManualVideos(
        job.source_url || undefined,
        job.platform,
        job.video_type,
        job.manual_videos!
      );
      await updateJob(supabase, job.id, {
        status: "ready",
        analysis: outcome.analysis,
        candidates: outcome.candidates,
        conversation: outcome.conversation,
      });
      return;
    }

    const cacheKey = researchCacheKey(job.source_url, job.platform, job.video_type);
    const cached = await getCachedResearch(cacheKey);
    // A cache entry written before real transcripts ever landed for this
    // channel (see the transcriptCount check below) isn't worth reusing --
    // treat it as a miss so this request gives transcript fetching a fresh,
    // independent shot instead of perpetuating title-only SOPs forever.
    const cacheIsUsable = cached !== null && conversationHasTranscripts(cached.conversation);

    if (cached && cacheIsUsable) {
      await updateJob(supabase, job.id, { status: "generating_bends" });
      try {
        await chargeUser(
          job.user_id,
          TOOL_CREDIT_COSTS.nicheBend.analyzeCacheHit,
          "Niche Bend Analysis (cached)",
          "niche_bend.analyze_cache_hit"
        );
        charged = { amount: TOOL_CREDIT_COSTS.nicheBend.analyzeCacheHit, actionKey: "niche_bend.analyze_cache_hit" };
      } catch (creditError) {
        if (creditError instanceof InsufficientCreditsError) {
          await updateJob(supabase, job.id, { status: "failed", error_message: "Insufficient credits" });
          return;
        }
        console.error("[credits] Charge failed, proceeding without charge:", creditError);
      }
      const outcome = await regenerateCandidates(cached.conversation, cached.analysis);
      await setCachedResearch(cacheKey, { analysis: cached.analysis, conversation: outcome.conversation });
      await updateJob(supabase, job.id, {
        status: "ready",
        analysis: cached.analysis,
        candidates: outcome.candidates,
        conversation: outcome.conversation,
      });
      return;
    }

    await updateJob(supabase, job.id, { status: "reading_videos" });
    try {
      await chargeUser(
        job.user_id,
        TOOL_CREDIT_COSTS.nicheBend.analyzeScrape,
        "Niche Bend Analysis",
        "niche_bend.analyze_scrape"
      );
      charged = { amount: TOOL_CREDIT_COSTS.nicheBend.analyzeScrape, actionKey: "niche_bend.analyze_scrape" };
    } catch (creditError) {
      if (creditError instanceof InsufficientCreditsError) {
        await updateJob(supabase, job.id, { status: "failed", error_message: "Insufficient credits" });
        return;
      }
      console.error("[credits] Charge failed, proceeding without charge:", creditError);
    }
    const outcome = await researchChannel(job.source_url, job.platform, job.video_type);
    await updateJob(supabase, job.id, { status: "generating_bends" });
    // Only cache research that actually landed real transcripts -- this cache
    // is shared cross-user with no expiry, so caching a transcript-less
    // result (a slow/rate-limited ScrapeCreators moment) would permanently
    // stick every future SOP for this channel with title-only grounding
    // instead of giving the next request a fresh shot at fetching them.
    if (outcome.transcriptCount > 0) {
      await setCachedResearch(cacheKey, { analysis: outcome.analysis, conversation: outcome.conversation });
    }
    await updateJob(supabase, job.id, {
      status: "ready",
      analysis: outcome.analysis,
      candidates: outcome.candidates,
      conversation: outcome.conversation,
    });
  } catch (error) {
    console.error("[niche-bend] Analysis pipeline failed:", error);
    if (charged) {
      await refundUser(job.user_id, charged.amount, "Niche Bend Analysis refund", charged.actionKey);
    }
    try {
      await updateJob(supabase, job.id, { status: "failed", error_message: humanizeError(error) });
    } catch (writeError) {
      // If even the failure write doesn't land, there's nothing left to try —
      // logging it is the only way this ever gets seen. The job stays stuck
      // on its last status client-side, but that only happens if the DB
      // itself is unreachable, which no amount of application-level error
      // handling can route around.
      console.error("[niche-bend] Could not persist the failure status either:", writeError);
    }
  }
}

export async function createJob(
  supabase: SupabaseClient,
  userId: string,
  input: {
    sourceUrl: string;
    platform: NicheBendPlatform;
    videoType: NicheBendVideoType;
    manualVideos?: NicheBendVideo[];
  }
): Promise<NicheBendJobRow> {
  const { data, error } = await supabase
    .from("niche_bend_jobs")
    .insert({
      user_id: userId,
      source_url: input.sourceUrl,
      platform: input.platform,
      video_type: input.videoType,
      manual_videos: input.manualVideos ?? null,
      status: "opening_channel",
    })
    .select(JOB_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create job");
  }

  const job = data as NicheBendJobRow;
  // `after()` (not a bare fire-and-forget `void`) keeps the serverless
  // invocation alive until the pipeline settles. Without it, Vercel is free
  // to freeze/tear down the function the instant the analyze route's HTTP
  // response is flushed — the in-flight Apify/Gemini calls then get cut off
  // mid-request and surface as raw, unrecognized errors instead of ever
  // reaching runPipeline's own error handling.
  after(() => runPipeline(supabase, job));
  return job;
}

// Self-healing fix for rows scraped before the avatar-fallback lookups
// existed (or hit by an actor that omitted the field): fills in avatarUrl
// and persists it, so the lookup only ever has to run once per row. No-op
// (no network call) once analysis has an avatarUrl, so this is cheap to run
// on every read. Best-effort -- a lookup failure just leaves the row as-is.
type AvatarBackfillableRow = Pick<NicheBendJobRow, "id" | "source_url" | "platform" | "analysis">;

async function backfillRowAvatar<T extends AvatarBackfillableRow>(supabase: SupabaseClient, row: T): Promise<T> {
  if (!row.analysis || row.analysis.avatarUrl) return row;
  const avatarUrl = await backfillAvatarUrl(row.source_url, row.platform).catch(() => undefined);
  if (!avatarUrl) return row;
  const analysis = { ...row.analysis, avatarUrl };
  await updateJob(supabase, row.id, { analysis }).catch(() => {});
  return { ...row, analysis };
}

// Every reader of a job (status polling, SOP preview, regenerate-candidate,
// history/library lists) goes through this or listJobs below, so wiring the
// backfill in here means no call site has to remember to ask for it.
export async function getJob(supabase: SupabaseClient, id: string): Promise<NicheBendJobRow | null> {
  const { data } = await supabase.from("niche_bend_jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle();
  const job = (data as NicheBendJobRow) ?? null;
  return job ? backfillRowAvatar(supabase, job) : null;
}

// RLS scopes the delete to the caller's own jobs, so this is a no-op (zero
// rows affected, no error) if the id belongs to someone else or is already
// gone — the route treats both the same as a successful delete.
export async function deleteJob(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("niche_bend_jobs").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete niche_bend_jobs (${id}): ${error.message}`);
  }
}

export interface NicheBendJobHistoryRow {
  id: string;
  source_url: string;
  platform: NicheBendPlatform;
  video_type: NicheBendVideoType;
  status: NicheBendJobStatus;
  analysis: NicheBendChannelAnalysis | null;
  chosen_bend: NicheBendCandidate | null;
  saved: boolean;
  created_at: string;
  updated_at: string;
}

const HISTORY_COLUMNS =
  "id, source_url, platform, video_type, status, analysis, chosen_bend, saved, created_at, updated_at";

// RLS scopes this to the caller's own jobs, same as getJob.
export async function listJobs(
  supabase: SupabaseClient,
  limit = 20,
  opts?: { savedOnly?: boolean }
): Promise<NicheBendJobHistoryRow[]> {
  let query = supabase
    .from("niche_bend_jobs")
    .select(HISTORY_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.savedOnly) {
    query = query.eq("saved", true);
  }

  const { data } = await query;
  return (data as NicheBendJobHistoryRow[]) ?? [];
}

// List variant of backfillRowAvatar above, for the history/library routes.
export async function backfillMissingAvatars(
  supabase: SupabaseClient,
  rows: NicheBendJobHistoryRow[]
): Promise<NicheBendJobHistoryRow[]> {
  return Promise.all(rows.map((row) => backfillRowAvatar(supabase, row)));
}

// RLS scopes the update to the caller's own jobs, same as deleteJob.
export async function setJobSaved(supabase: SupabaseClient, id: string, saved: boolean): Promise<void> {
  const { error } = await supabase.from("niche_bend_jobs").update({ saved }).eq("id", id);
  if (error) {
    throw new Error(`Failed to update niche_bend_jobs saved flag (${id}): ${error.message}`);
  }
}

export function resolveStatus(job: NicheBendJobRow): NicheBendJobStatusResponse {
  const { statusText, progress } = PHASE_TEXT[job.status];

  const response: NicheBendJobStatusResponse = {
    jobId: job.id,
    status: job.status,
    statusText,
    progress,
    saved: job.saved,
  };

  // Not only surfaced for status === "failed": a background SOP generation
  // failure reverts status to "ready" (the job itself is still fine, just
  // the SOP attempt wasn't), so error_message can be set on a non-"failed"
  // status too. Whenever it's present, the client should see it.
  if (job.error_message) {
    response.error = { message: job.error_message };
  }

  if (job.analysis) response.analysis = job.analysis;
  if (job.candidates) response.candidates = job.candidates;
  if (job.sop) response.sop = job.sop;

  return response;
}

export async function regenerateOneCandidateInJob(
  supabase: SupabaseClient,
  job: NicheBendJobRow,
  candidateId: 1 | 2 | 3
): Promise<NicheBendCandidate[]> {
  const { analysis, candidates } = job;
  if (!analysis || !candidates) {
    throw new Error("Job is not ready yet");
  }
  if (!candidates.some((candidate) => candidate.id === candidateId)) {
    throw new Error("Invalid candidateId");
  }

  const otherCandidates = candidates.filter((candidate) => candidate.id !== candidateId);
  const { candidate, conversation } = await regenerateOneCandidate(job.conversation ?? [], analysis, otherCandidates);

  const newCandidate: NicheBendCandidate = { ...candidate, id: candidateId };
  const nextCandidates = candidates.map((c) => (c.id === candidateId ? newCandidate : c));

  await updateJob(supabase, job.id, { candidates: nextCandidates, conversation });
  return nextCandidates;
}

// SOP writing is two sequential structured-output calls (see
// generateSopContent) that can each take minutes — the same shape of problem
// as the initial channel analysis. So this follows the same async pattern as
// createJob()/runPipeline(): flip status synchronously (fast, so the route
// can respond immediately), then let the actual writing continue via after()
// while the client polls for "sop_ready".
export async function startSopGeneration(
  supabase: SupabaseClient,
  job: NicheBendJobRow,
  chosenBendId: 1 | 2 | 3
): Promise<NicheBendJobRow> {
  if (job.sop) return job;

  const candidates = job.candidates;
  const analysis = job.analysis;
  if (!candidates || !analysis) {
    throw new Error("Job is not ready yet");
  }

  const chosen = candidates.find((candidate) => candidate.id === chosenBendId);
  if (!chosen) {
    throw new Error("Invalid chosenBend id");
  }

  // Clear out any error_message left over from a previous failed SOP attempt
  // on this same job — otherwise resolveStatus would keep surfacing it.
  await updateJob(supabase, job.id, { chosen_bend: chosen, status: "generating_sop", error_message: null });

  after(() => runSopGeneration(supabase, job.id, job.user_id, job.conversation ?? [], analysis, chosen));

  return { ...job, chosen_bend: chosen, status: "generating_sop", error_message: null };
}

async function runSopGeneration(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  conversation: MessageParam[],
  analysis: NicheBendChannelAnalysis,
  chosen: NicheBendCandidate
): Promise<void> {
  try {
    await chargeUser(userId, TOOL_CREDIT_COSTS.nicheBend.sop, "SOP Generation", "niche_bend.sop");
  } catch (creditError) {
    if (creditError instanceof InsufficientCreditsError) {
      await updateJob(supabase, jobId, { status: "ready", error_message: "Insufficient credits" });
      return;
    }
    console.error("[credits] Charge failed, proceeding without charge:", creditError);
  }

  let content;
  try {
    content = await generateSopContent(conversation, analysis, chosen);
  } catch (error) {
    console.error("[niche-bend] SOP generation failed:", error);
    await refundUser(userId, TOOL_CREDIT_COSTS.nicheBend.sop, "SOP Generation refund", "niche_bend.sop");
    try {
      await updateJob(supabase, jobId, { status: "ready", error_message: humanizeError(error) });
    } catch (writeError) {
      console.error("[niche-bend] Could not persist the SOP failure status either:", writeError);
    }
    return;
  }

  const sop: NicheBendSopResult = {
    id: `sop-${jobId}`,
    jobId,
    chosenBend: chosen,
    originalChannel: analysis,
    content,
    downloads: {
      // Real DOCX/PDF generation + storage isn't built yet — still a placeholder.
      docxUrl: `/mock/niche-bend/${jobId}.docx`,
      pdfUrl: `/mock/niche-bend/${jobId}.pdf`,
    },
    createdAt: new Date().toISOString(),
  };

  try {
    await updateJob(supabase, jobId, { sop, status: "sop_ready" });
  } catch (writeError) {
    console.error("[niche-bend] Could not persist the completed SOP:", writeError);
  }
}
