import type { SupabaseClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchTranscript, VideoProviderError } from "@/lib/server/video-provider";
import { facelessClassifierModel, FACELESS_CLASSIFIER_MODEL } from "@/lib/server/openrouter-client";
import { NICHE_ORDER } from "@/lib/niches-catalog";
import type { TrendingVideoRow } from "@/lib/server/trending-videos";
import type { TranscriptAnalysis } from "@/lib/types";

export class VideoEnrichmentError extends Error {}

const FORMAT_TAGS = ["top5_ranking", "roblox_gaming", "commentary", "animation_2d", "other"] as const;

const AnalysisSchema = z.object({
  niche: z.enum(NICHE_ORDER),
  is_faceless: z.boolean(),
  confidence: z.number().min(0).max(100),
  format_tags: z.array(z.enum(FORMAT_TAGS)).max(2),
  summary: z.string(),
  reasoning: z.string(),
});

export type VideoTranscriptAnalysis = z.infer<typeof AnalysisSchema>;

// Shared with the client via lib/types.ts (TranscriptAnalysis) -- see that
// file for why: it's the same convention faceless-classifier.ts follows for
// FacelessClassification, so a structured AI-analysis shape only has one
// definition regardless of which side of the client/server boundary reads it.

const ANALYSIS_TIMEOUT_MS = 45_000;
const ANALYSIS_MAX_OUTPUT_TOKENS = 800;
// Gemini's context window can hold a full transcript, but a niche/faceless
// verdict is evident well before minute 20 of a long video -- capping input
// length bounds cost per call without hurting classification accuracy.
const MAX_TRANSCRIPT_CHARS = 6_000;

const SYSTEM_PROMPT = `You are Verlab's video content analyst. Given a video's title, creator, hashtag, and transcript, identify (1) which single niche from the fixed catalog it best belongs to, (2) whether it is a "faceless" video -- defined as content produced without the creator's real physical face on camera (e.g. voiceover-narrated stock/AI footage, 2D/3D animation, whiteboard explainer, screen recording, text-on-screen storytelling). A video showing a real human host on camera -- even briefly -- is NOT faceless. And (3) 0-2 format/sub-genre tags from this fixed set, based on what the title/transcript actually show: top5_ranking (countdown or ranked-list format -- "top 5", "ranked worst to best", numbered items), roblox_gaming (gameplay footage, primarily Roblox or another game, is the main visual/subject), commentary (reacting to or analyzing existing content, news, or drama -- not gameplay, not a ranking), animation_2d (primary visual style is 2D animation/motion graphics, not live footage or gameplay). Only assign a tag that clearly applies from the evidence given -- most videos get 0-1 tags; use "other" or an empty list rather than forcing a fit. Base every verdict only on evidence in the transcript and metadata given; when the evidence is ambiguous, favor a lower confidence_score rather than guessing. Be terse and evidence-based -- your reasoning must cite the specific signal(s) that drove the verdict.`;

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new VideoEnrichmentError(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(input: { title: string; author: string; hashtag: string; transcriptText: string }): string {
  const truncated = input.transcriptText.length > MAX_TRANSCRIPT_CHARS;
  const transcript = input.transcriptText.slice(0, MAX_TRANSCRIPT_CHARS);
  return `Title: ${input.title}
Creator: ${input.author}
Hashtag: ${input.hashtag || "(none)"}

Transcript${truncated ? " (truncated)" : ""}:
${transcript || "(empty transcript)"}

Classify this video now. Respond only in the required structured format.`;
}

/**
 * Runs the Gemini structured-output analysis pass on one video's transcript.
 * Pure -- does not touch Supabase or fetch the transcript itself. Reuses
 * facelessClassifierModel (google/gemini-2.5-flash via OpenRouter, see
 * openrouter-client.ts) rather than declaring a second model instance
 * pointed at the same slug -- there's no reason for this pass and the
 * faceless-channel classifier to ever drift onto different models
 * independently.
 */
export async function analyzeVideoTranscript(input: {
  title: string;
  author: string;
  hashtag: string;
  transcriptText: string;
}): Promise<VideoTranscriptAnalysis> {
  try {
    const { object } = await withTimeout(
      generateObject({
        model: facelessClassifierModel,
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(input),
        schema: AnalysisSchema,
        maxOutputTokens: ANALYSIS_MAX_OUTPUT_TOKENS,
      }),
      ANALYSIS_TIMEOUT_MS,
      `Gemini transcript analysis took too long to respond (over ${Math.round(ANALYSIS_TIMEOUT_MS / 1000)}s).`
    );
    return object;
  } catch (error) {
    if (error instanceof VideoEnrichmentError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new VideoEnrichmentError(`Gemini transcript analysis request failed: ${message}`);
  }
}

export type EnrichmentQueueRow = Pick<TrendingVideoRow, "id" | "title" | "author" | "hashtag" | "video_url">;

/**
 * Enriches a single trending_videos row: fetches its transcript, runs the
 * Gemini analysis pass, and writes the verdict onto transcript_analysis.
 * Returns the terminal status that got stored, or `null` if the Supabase
 * write itself failed (row is left NULL, so the next tick's queue query
 * picks it back up).
 *
 * Every reachable outcome -- a real analysis, an unavailable transcript, or
 * a provider/model error -- writes a non-null, terminal JSONB value. This is
 * deliberate: the queue (runNicheVideoEnrichmentTick) selects strictly on
 * `transcript_analysis IS NULL` via the partial index added in
 * 20260819130000_trending_videos_transcript_analysis.sql, so a video that
 * fails permanently (dead link, no captions, unsupported platform) has to be
 * marked terminal or it gets re-selected -- and re-billed against the same
 * failure -- forever. There's no retry/backoff on top of this yet; add one
 * (e.g. an attempt counter inside the stored JSONB) if transient failures
 * turn out to be common enough to matter.
 */
export async function enrichVideo(
  admin: SupabaseClient,
  video: EnrichmentQueueRow
): Promise<TranscriptAnalysis["status"] | null> {
  let stored: TranscriptAnalysis;

  try {
    const transcript = await fetchTranscript(video.video_url);
    const transcriptText = transcript.lines
      .map((line) => line.text)
      .join(" ")
      .trim();

    if (!transcriptText) {
      stored = { status: "unavailable", reason: "Transcript came back empty.", failed_at: new Date().toISOString() };
    } else {
      const analysis = await analyzeVideoTranscript({
        title: video.title,
        author: video.author,
        hashtag: video.hashtag,
        transcriptText,
      });
      stored = {
        status: "analyzed",
        analyzed_at: new Date().toISOString(),
        model: FACELESS_CLASSIFIER_MODEL,
        ...analysis,
      };
    }
  } catch (error) {
    if (error instanceof VideoProviderError) {
      // Not found, no captions available, unsupported platform, etc. --
      // an expected shape of failure, not a system error.
      stored = { status: "unavailable", reason: error.message, failed_at: new Date().toISOString() };
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[niche-video-enrichment] enrichment failed for ${video.id}:`, error);
      stored = { status: "failed", error: message, failed_at: new Date().toISOString() };
    }
  }

  const { error: updateError } = await admin
    .from("trending_videos")
    .update({ transcript_analysis: stored })
    .eq("id", video.id);

  if (updateError) {
    console.error(`[niche-video-enrichment] failed to store analysis for ${video.id}:`, updateError.message);
    return null;
  }
  return stored.status;
}

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
// Each video is a transcript fetch (ScrapeCreators, seconds-scale) chained
// into a Gemini call -- bounds concurrent outbound calls the same way
// NICHE_CONCURRENCY does in niche-video-backfill.ts.
const ENRICHMENT_CONCURRENCY = 3;
// Matches the 300s maxDuration ceiling used by the other deep-worker admin
// routes (see niche-videos-backfill/route.ts), with headroom for the
// response to actually return.
const TICK_WALL_CLOCK_BUDGET_MS = 270_000;

const ENRICHMENT_QUEUE_COLUMNS = "id, title, author, hashtag, video_url";

export interface EnrichmentTickResult {
  processed: number;
  analyzed: number;
  unavailable: number;
  failed: number;
}

/**
 * Loads up to `limit` not-yet-analyzed rows, oldest-refreshed first within
 * each platform, split evenly across tiktok/youtube rather than one combined
 * cross-platform query. TikTok's pool is both larger and more frequently
 * refreshed, so a single "oldest refreshed_at first" query across both
 * platforms tends to let TikTok rows dominate every tick's batch, leaving
 * YouTube rows perpetually unanalyzed even once fully caught up on TikTok --
 * confirmed against real data (zero YouTube rows had ever been analyzed).
 * Each half still hits the partial index from
 * 20260819130000_trending_videos_transcript_analysis.sql for its
 * transcript_analysis IS NULL + refreshed_at scan.
 */
async function loadEnrichmentQueue(admin: SupabaseClient, limit: number): Promise<EnrichmentQueueRow[]> {
  const perPlatform = Math.ceil(limit / 2);
  const [tiktokRows, youtubeRows] = await Promise.all([
    admin
      .from("trending_videos")
      .select(ENRICHMENT_QUEUE_COLUMNS)
      .eq("platform", "tiktok")
      .is("transcript_analysis", null)
      .order("refreshed_at", { ascending: true })
      .limit(perPlatform),
    admin
      .from("trending_videos")
      .select(ENRICHMENT_QUEUE_COLUMNS)
      .eq("platform", "youtube")
      .is("transcript_analysis", null)
      .order("refreshed_at", { ascending: true })
      .limit(perPlatform),
  ]);

  if (tiktokRows.error) {
    console.error("[niche-video-enrichment] failed to load tiktok enrichment queue:", tiktokRows.error.message);
  }
  if (youtubeRows.error) {
    console.error("[niche-video-enrichment] failed to load youtube enrichment queue:", youtubeRows.error.message);
  }

  return [...((tiktokRows.data ?? []) as EnrichmentQueueRow[]), ...((youtubeRows.data ?? []) as EnrichmentQueueRow[])].slice(
    0,
    limit
  );
}

/**
 * Runs one enrichment tick: pulls up to `batchSize` not-yet-analyzed
 * trending_videos rows (oldest-refreshed first per platform, split evenly --
 * see loadEnrichmentQueue -- so a long-neglected video doesn't get starved
 * behind a constant stream of newly-scraped ones, and one platform's larger
 * pool doesn't starve the other's) and enriches them with bounded
 * concurrency. Safe to call repeatedly on a schedule -- each tick only ever
 * claims rows still sitting at transcript_analysis IS NULL, so
 * overlapping/retried ticks don't duplicate work once a row lands a terminal
 * status.
 */
export async function runNicheVideoEnrichmentTick(
  admin: SupabaseClient = createAdminClient() as SupabaseClient,
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<EnrichmentTickResult> {
  const limit = Math.min(MAX_BATCH_SIZE, Math.max(1, batchSize));

  const result: EnrichmentTickResult = { processed: 0, analyzed: 0, unavailable: 0, failed: 0 };

  const queue = await loadEnrichmentQueue(admin, limit);
  if (queue.length === 0) return result;

  let nextIndex = 0;
  const deadline = Date.now() + TICK_WALL_CLOCK_BUDGET_MS;

  async function worker(): Promise<void> {
    for (let i = nextIndex++; i < queue.length && Date.now() < deadline; i = nextIndex++) {
      const status = await enrichVideo(admin, queue[i]);
      result.processed++;
      if (status === "analyzed") result.analyzed++;
      else if (status === "unavailable") result.unavailable++;
      else if (status === "failed") result.failed++;
      // status === null: the DB write itself failed: row stays NULL and is
      // picked back up by the next tick, so it's deliberately not counted
      // in analyzed/unavailable/failed above.
    }
  }

  await Promise.all(Array.from({ length: Math.min(ENRICHMENT_CONCURRENCY, queue.length) }, worker));
  return result;
}
