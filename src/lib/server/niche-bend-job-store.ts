import type { ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import {
  NicheBendAiError,
  dedupeCandidatesAgainstClaims,
  generateSopContent,
  regenerateCandidates,
  regenerateOneCandidate,
  researchChannel,
  researchFromManualVideos,
} from "./niche-bend-ai";
import {
  NicheAlreadyClaimedError,
  claimNiche,
  getClaimedNichesForAvoidance,
  normalizeNicheKey,
} from "./niche-bend-claims";
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
  reading_videos: { statusText: "Reading top 10 videos…", progress: 35 },
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

    const avoidance = await getClaimedNichesForAvoidance();

    if (hasManualVideos) {
      await updateJob(supabase, job.id, { status: "identifying_format" });
      const outcome = await researchFromManualVideos(
        job.source_url || undefined,
        job.platform,
        job.video_type,
        job.manual_videos!,
        avoidance.names
      );
      const deduped = await dedupeCandidatesAgainstClaims(
        outcome.candidates,
        outcome.analysis,
        outcome.conversation,
        avoidance.keys
      );
      await updateJob(supabase, job.id, {
        status: "ready",
        analysis: outcome.analysis,
        candidates: deduped.candidates,
        conversation: deduped.conversation,
      });
      return;
    }

    const cacheKey = researchCacheKey(job.source_url, job.platform, job.video_type);
    const cached = await getCachedResearch(cacheKey);

    if (cached) {
      await updateJob(supabase, job.id, { status: "generating_bends" });
      const outcome = await regenerateCandidates(cached.conversation, cached.analysis, avoidance.names);
      const deduped = await dedupeCandidatesAgainstClaims(
        outcome.candidates,
        cached.analysis,
        outcome.conversation,
        avoidance.keys
      );
      await setCachedResearch(cacheKey, { analysis: cached.analysis, conversation: deduped.conversation });
      await updateJob(supabase, job.id, {
        status: "ready",
        analysis: cached.analysis,
        candidates: deduped.candidates,
        conversation: deduped.conversation,
      });
      return;
    }

    await updateJob(supabase, job.id, { status: "reading_videos" });
    const outcome = await researchChannel(job.source_url, job.platform, job.video_type, avoidance.names);
    await updateJob(supabase, job.id, { status: "generating_bends" });
    const deduped = await dedupeCandidatesAgainstClaims(
      outcome.candidates,
      outcome.analysis,
      outcome.conversation,
      avoidance.keys
    );
    await setCachedResearch(cacheKey, { analysis: outcome.analysis, conversation: deduped.conversation });
    await updateJob(supabase, job.id, {
      status: "ready",
      analysis: outcome.analysis,
      candidates: deduped.candidates,
      conversation: deduped.conversation,
    });
  } catch (error) {
    console.error("[niche-bend] Analysis pipeline failed:", error);
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

export async function getJob(supabase: SupabaseClient, id: string): Promise<NicheBendJobRow | null> {
  const { data } = await supabase.from("niche_bend_jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle();
  return (data as NicheBendJobRow) ?? null;
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

// RLS scopes the update to the caller's own jobs, same as deleteJob.
export async function setJobSaved(supabase: SupabaseClient, id: string, saved: boolean): Promise<void> {
  const { error } = await supabase.from("niche_bend_jobs").update({ saved }).eq("id", id);
  if (error) {
    throw new Error(`Failed to update niche_bend_jobs saved flag (${id}): ${error.message}`);
  }
}

export function resolveStatus(job: NicheBendJobRow): NicheBendJobStatusResponse {
  const { statusText, progress } = PHASE_TEXT[job.status];

  if (job.status === "failed") {
    return {
      jobId: job.id,
      status: "failed",
      statusText,
      progress,
      saved: job.saved,
      error: { message: job.error_message ?? "Something went wrong." },
    };
  }

  const response: NicheBendJobStatusResponse = {
    jobId: job.id,
    status: job.status,
    statusText,
    progress,
    saved: job.saved,
  };

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
  const avoidance = await getClaimedNichesForAvoidance();
  let { candidate, conversation } = await regenerateOneCandidate(
    job.conversation ?? [],
    analysis,
    otherCandidates,
    avoidance.names
  );

  // Same claim-collision backstop as the initial generation pass — this is
  // a single-candidate reroll, so the retry loop lives here directly rather
  // than going through dedupeCandidatesAgainstClaims (which dedupes a batch).
  let attempts = 0;
  while (avoidance.keys.has(normalizeNicheKey(candidate.nicheName)) && attempts < 3) {
    ({ candidate, conversation } = await regenerateOneCandidate(conversation, analysis, otherCandidates, avoidance.names));
    attempts++;
  }

  const newCandidate: NicheBendCandidate = { ...candidate, id: candidateId };
  const nextCandidates = candidates.map((c) => (c.id === candidateId ? newCandidate : c));

  await updateJob(supabase, job.id, { candidates: nextCandidates, conversation });
  return nextCandidates;
}

export async function setChosenBendAndGenerateSop(
  supabase: SupabaseClient,
  job: NicheBendJobRow,
  chosenBendId: 1 | 2 | 3
): Promise<NicheBendSopResult> {
  if (job.sop) return job.sop;

  const candidates = job.candidates;
  const analysis = job.analysis;
  if (!candidates || !analysis) {
    throw new Error("Job is not ready yet");
  }

  const chosen = candidates.find((candidate) => candidate.id === chosenBendId);
  if (!chosen) {
    throw new Error("Invalid chosenBend id");
  }

  // Reserve the niche before spending the (expensive) SOP generation call.
  // This is the actual enforcement point — candidate generation upstream
  // only reduces the odds of a collision, this atomic insert is what
  // guarantees exclusivity even if two users pick the same niche at once.
  const claimed = await claimNiche({
    nicheName: chosen.nicheName,
    angle: chosen.angle,
    exampleTitles: chosen.exampleTitles,
    userId: job.user_id,
    jobId: job.id,
    channelName: analysis.channelName,
    avatarUrl: analysis.avatarUrl ?? null,
    platform: job.platform,
  });
  if (!claimed) {
    throw new NicheAlreadyClaimedError(chosen.nicheName);
  }

  await updateJob(supabase, job.id, { chosen_bend: chosen, status: "generating_sop" });

  let content;
  try {
    content = await generateSopContent(job.conversation ?? [], analysis, chosen);
  } catch (error) {
    console.error("[niche-bend] SOP generation failed:", error);
    await updateJob(supabase, job.id, { status: "ready" });
    throw new Error(humanizeError(error));
  }

  const sop: NicheBendSopResult = {
    id: `sop-${job.id}`,
    jobId: job.id,
    chosenBend: chosen,
    originalChannel: analysis,
    content,
    downloads: {
      // Real DOCX/PDF generation + storage isn't built yet — still a placeholder.
      docxUrl: `/mock/niche-bend/${job.id}.docx`,
      pdfUrl: `/mock/niche-bend/${job.id}.pdf`,
    },
    createdAt: new Date().toISOString(),
  };

  await updateJob(supabase, job.id, { sop, status: "sop_ready" });
  return sop;
}
