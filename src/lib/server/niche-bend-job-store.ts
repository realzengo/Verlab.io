import type { ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NicheBendAiError,
  generateSopContent,
  regenerateCandidates,
  researchChannel,
  researchFromManualVideos,
} from "./niche-bend-ai";
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
}

const JOB_COLUMNS =
  "id, source_url, platform, video_type, manual_videos, status, error_message, analysis, candidates, conversation, chosen_bend, sop";

interface ResearchCacheEntry {
  analysis: NicheBendChannelAnalysis;
  conversation: MessageParam[];
}

function researchCacheKey(sourceUrl: string, platform: NicheBendPlatform, videoType: NicheBendVideoType): string {
  return `${platform}|${videoType}|${sourceUrl.trim().toLowerCase()}`;
}

// Internal dedup cache is cross-user infra (not RLS'd user data), so it goes
// through the service-role client rather than the caller's session client.
async function getCachedResearch(cacheKey: string): Promise<ResearchCacheEntry | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("niche_bend_research_cache")
    .select("analysis, conversation")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  return data ? { analysis: data.analysis, conversation: data.conversation } : null;
}

async function setCachedResearch(cacheKey: string, entry: ResearchCacheEntry): Promise<void> {
  const admin = createAdminClient();
  await admin.from("niche_bend_research_cache").upsert({
    cache_key: cacheKey,
    analysis: entry.analysis,
    conversation: entry.conversation,
    updated_at: new Date().toISOString(),
  });
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
  await supabase.from("niche_bend_jobs").update(patch).eq("id", id);
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

    if (hasManualVideos) {
      await updateJob(supabase, job.id, { status: "identifying_format" });
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

    if (cached) {
      await updateJob(supabase, job.id, { status: "generating_bends" });
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
    const outcome = await researchChannel(job.source_url, job.platform, job.video_type);
    await updateJob(supabase, job.id, { status: "generating_bends" });
    await setCachedResearch(cacheKey, { analysis: outcome.analysis, conversation: outcome.conversation });
    await updateJob(supabase, job.id, {
      status: "ready",
      analysis: outcome.analysis,
      candidates: outcome.candidates,
      conversation: outcome.conversation,
    });
  } catch (error) {
    console.error("[niche-bend] Analysis pipeline failed:", error);
    await updateJob(supabase, job.id, { status: "failed", error_message: humanizeError(error) });
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
  void runPipeline(supabase, job);
  return job;
}

export async function getJob(supabase: SupabaseClient, id: string): Promise<NicheBendJobRow | null> {
  const { data } = await supabase.from("niche_bend_jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle();
  return (data as NicheBendJobRow) ?? null;
}

export function resolveStatus(job: NicheBendJobRow): NicheBendJobStatusResponse {
  const { statusText, progress } = PHASE_TEXT[job.status];

  if (job.status === "failed") {
    return {
      jobId: job.id,
      status: "failed",
      statusText,
      progress,
      error: { message: job.error_message ?? "Something went wrong." },
    };
  }

  const response: NicheBendJobStatusResponse = {
    jobId: job.id,
    status: job.status,
    statusText,
    progress,
  };

  if (job.analysis) response.analysis = job.analysis;
  if (job.candidates) response.candidates = job.candidates;
  if (job.sop) response.sop = job.sop;

  return response;
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
