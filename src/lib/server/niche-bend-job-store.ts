import type Anthropic from "@anthropic-ai/sdk";
import {
  NicheBendAiError,
  generateSopContent,
  regenerateCandidates,
  researchChannel,
  researchFromManualVideos,
} from "./niche-bend-ai";
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

type MessageParam = Anthropic.Messages.MessageParam;

// In-memory, per-process job store. Fine for a single `next dev` process; a
// real deployment would replace this module's exports with a DB/queue
// without touching any of its callers.

interface NicheBendJobRecord {
  id: string;
  sourceUrl: string;
  platform: NicheBendPlatform;
  videoType: NicheBendVideoType;
  manualVideos?: NicheBendVideo[];
  phase: NicheBendJobStatus;
  errorMessage?: string;
  analysis?: NicheBendChannelAnalysis;
  candidates?: NicheBendCandidate[];
  conversation?: MessageParam[];
  chosenBend?: NicheBendCandidate;
  sop?: NicheBendSopResult;
}

interface ResearchCacheEntry {
  analysis: NicheBendChannelAnalysis;
  conversation: MessageParam[];
}

// Next dev's Fast Refresh re-executes this module (resetting module-level
// state) whenever a file it depends on changes, even though the server
// process itself is still running. Stash the maps on `globalThis` so an
// in-flight job survives that reload instead of turning into a spurious
// 404 "Job not found" the next time the client polls or submits.
declare global {
  var __nicheBendJobs: Map<string, NicheBendJobRecord> | undefined;
  var __nicheBendResearchCache: Map<string, ResearchCacheEntry> | undefined;
}

const jobs = globalThis.__nicheBendJobs ?? new Map<string, NicheBendJobRecord>();
globalThis.__nicheBendJobs = jobs;

// Avoids re-running (paid) web search when the same channel is analyzed
// again in the same process — "Regenerate bends" reuses the research and
// only asks Claude for a fresh set of candidates.
const researchCache = globalThis.__nicheBendResearchCache ?? new Map<string, ResearchCacheEntry>();
globalThis.__nicheBendResearchCache = researchCache;

function researchCacheKey(sourceUrl: string, platform: NicheBendPlatform, videoType: NicheBendVideoType): string {
  return `${platform}|${videoType}|${sourceUrl.trim().toLowerCase()}`;
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

async function runPipeline(job: NicheBendJobRecord): Promise<void> {
  try {
    const hasManualVideos = Boolean(job.manualVideos && job.manualVideos.length > 0);

    if (!hasManualVideos && isFailureTrigger(job.sourceUrl)) {
      await sleep(1500);
      job.phase = "failed";
      job.errorMessage = "We couldn't read that channel. Try again or paste your videos manually.";
      return;
    }

    if (hasManualVideos) {
      job.phase = "identifying_format";
      const outcome = await researchFromManualVideos(
        job.sourceUrl || undefined,
        job.platform,
        job.videoType,
        job.manualVideos!
      );
      job.phase = "generating_bends";
      job.analysis = outcome.analysis;
      job.candidates = outcome.candidates;
      job.conversation = outcome.conversation;
      job.phase = "ready";
      return;
    }

    const cacheKey = researchCacheKey(job.sourceUrl, job.platform, job.videoType);
    const cached = researchCache.get(cacheKey);

    if (cached) {
      job.phase = "generating_bends";
      const outcome = await regenerateCandidates(cached.conversation, cached.analysis);
      job.analysis = cached.analysis;
      job.candidates = outcome.candidates;
      job.conversation = outcome.conversation;
      researchCache.set(cacheKey, { analysis: cached.analysis, conversation: outcome.conversation });
      job.phase = "ready";
      return;
    }

    job.phase = "reading_videos";
    const outcome = await researchChannel(job.sourceUrl, job.platform, job.videoType);
    job.phase = "generating_bends";
    job.analysis = outcome.analysis;
    job.candidates = outcome.candidates;
    job.conversation = outcome.conversation;
    researchCache.set(cacheKey, { analysis: outcome.analysis, conversation: outcome.conversation });
    job.phase = "ready";
  } catch (error) {
    console.error("[niche-bend] Analysis pipeline failed:", error);
    job.phase = "failed";
    job.errorMessage = humanizeError(error);
  }
}

export function createJob(input: {
  sourceUrl: string;
  platform: NicheBendPlatform;
  videoType: NicheBendVideoType;
  manualVideos?: NicheBendVideo[];
}): NicheBendJobRecord {
  const id = crypto.randomUUID();
  const job: NicheBendJobRecord = {
    id,
    sourceUrl: input.sourceUrl,
    platform: input.platform,
    videoType: input.videoType,
    manualVideos: input.manualVideos,
    phase: "opening_channel",
  };
  jobs.set(id, job);
  void runPipeline(job);
  return job;
}

export function getJob(id: string): NicheBendJobRecord | undefined {
  return jobs.get(id);
}

export function resolveStatus(job: NicheBendJobRecord): NicheBendJobStatusResponse {
  const { statusText, progress } = PHASE_TEXT[job.phase];

  if (job.phase === "failed") {
    return {
      jobId: job.id,
      status: "failed",
      statusText,
      progress,
      error: { message: job.errorMessage ?? "Something went wrong." },
    };
  }

  const response: NicheBendJobStatusResponse = {
    jobId: job.id,
    status: job.phase,
    statusText,
    progress,
  };

  if (job.analysis) response.analysis = job.analysis;
  if (job.candidates) response.candidates = job.candidates;
  if (job.sop) response.sop = job.sop;

  return response;
}

export async function setChosenBendAndGenerateSop(
  job: NicheBendJobRecord,
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

  job.chosenBend = chosen;
  job.phase = "generating_sop";

  let content;
  try {
    content = await generateSopContent(job.conversation ?? [], analysis, chosen);
  } catch (error) {
    console.error("[niche-bend] SOP generation failed:", error);
    job.phase = "ready";
    throw new Error(humanizeError(error));
  }

  const sop: NicheBendSopResult = {
    id: `sop-${job.id}`,
    jobId: job.id,
    chosenBend: chosen,
    originalChannel: analysis,
    content,
    downloads: {
      docxUrl: `/mock/niche-bend/${job.id}.docx`,
      pdfUrl: `/mock/niche-bend/${job.id}.pdf`,
    },
    createdAt: new Date().toISOString(),
  };

  job.sop = sop;
  job.phase = "sop_ready";
  return sop;
}
