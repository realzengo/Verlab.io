import { generateObject } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { facelessClassifierModel } from "./openrouter-client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FacelessChannelVideo, FacelessClassification } from "@/lib/types";

export class FacelessClassifierError extends Error {}

const SYSTEM_PROMPT = `You are Verlab's faceless-channel verification analyst. Analyze the provided channel metadata and top video titles/descriptions and determine, with extreme precision, whether this channel is a "Faceless Channel" -- defined as content produced without displaying the creator's real physical face on camera (e.g. 2D/3D Animation, Whiteboard, Stock Footage + Voiceover, Screen Recordings, AI-generated imagery, Reddit/Text Stories, Historical Documentaries). A channel that shows a real human host/vlogger on camera -- even briefly, even a talking-head intro -- is NOT faceless. Base your verdict only on evidence in the given metadata; when the avatar or titles suggest a real on-camera presenter, or the evidence is ambiguous, favor is_faceless: false with a lower confidence_score rather than guessing. You are terse and evidence-based -- your reasoning must cite the specific signal(s) that drove the verdict.`;

const FACELESS_CATEGORIES = [
  "2D Animation",
  "3D Animation",
  "Whiteboard",
  "Stock Footage",
  "AI Pictures",
  "Screen Recording",
  "Documentary",
] as const;

const COMPLEXITY_LEVELS = ["EASY", "MEDIUM", "HARD", "LEGENDARY"] as const;

const ClassificationSchema = z.object({
  is_faceless: z.boolean(),
  confidence_score: z.number().min(0).max(100),
  faceless_category: z.enum(FACELESS_CATEGORIES),
  complexity: z.enum(COMPLEXITY_LEVELS),
  viral_velocity_score: z.number().min(0).max(100),
  reasoning: z.string(),
});

export interface ChannelClassificationInput {
  channelTitle: string;
  channelDescription: string;
  subscriberCount: number;
  totalViews: number;
  /** Up to 10 recent videos; only the first 10 are sent to the model. */
  recentVideos: FacelessChannelVideo[];
  visualTags?: string[];
  avatarUrl?: string;
}

const MAX_RECENT_VIDEOS = 10;
const CLASSIFY_TIMEOUT_MS = 45_000;
const CLASSIFY_MAX_OUTPUT_TOKENS = 1200;

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new FacelessClassifierError(timeoutMessage)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(input: ChannelClassificationInput): string {
  const videos = input.recentVideos.slice(0, MAX_RECENT_VIDEOS);
  const videoList =
    videos.length > 0
      ? videos
          .map((video, index) => `${index + 1}. "${video.title}"${video.description ? ` -- ${video.description}` : ""}`)
          .join("\n")
      : "(no recent videos provided)";

  return `Channel title: ${input.channelTitle}
Channel description: ${input.channelDescription || "(none provided)"}
Subscriber count: ${input.subscriberCount}
Total views: ${input.totalViews}
Avatar image URL: ${input.avatarUrl || "(none provided)"}
Primary visual tags: ${input.visualTags?.length ? input.visualTags.join(", ") : "(none provided)"}

Recent videos:
${videoList}

Classify this channel now. viral_velocity_score should reflect view density relative to subscriber count (a channel whose recent videos consistently out-view its subscriber count scores high; one that under-performs its subscriber count scores low). Respond only in the required structured format.`;
}

function wrapProviderError(error: unknown): never {
  if (error instanceof FacelessClassifierError) throw error;
  const message = error instanceof Error ? error.message : String(error);
  throw new FacelessClassifierError(`Gemini classification request failed: ${message}`);
}

/**
 * Runs the Gemini 1.5 Flash structured-output classification pass. Pure --
 * does not touch Supabase. Use classifyAndStoreChannel to also persist the
 * result onto a `niche_channels` row.
 */
export async function classifyChannel(input: ChannelClassificationInput): Promise<FacelessClassification> {
  try {
    const { object } = await withTimeout(
      generateObject({
        model: facelessClassifierModel,
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(input),
        schema: ClassificationSchema,
        maxOutputTokens: CLASSIFY_MAX_OUTPUT_TOKENS,
      }),
      CLASSIFY_TIMEOUT_MS,
      `Gemini classifier took too long to respond (over ${Math.round(CLASSIFY_TIMEOUT_MS / 1000)}s). Try again.`
    );
    return object;
  } catch (error) {
    wrapProviderError(error);
  }
}

/**
 * Classifies a channel and writes the verdict onto its `niche_channels` row
 * (is_faceless, faceless_confidence, faceless_category, complexity,
 * viral_velocity_score, classification_reasoning, verified_at). Used by both
 * the ingestion worker and the admin "Auto-Classify with AI" action.
 */
export async function classifyAndStoreChannel(
  channelId: string,
  input: ChannelClassificationInput,
  admin: SupabaseClient = createAdminClient()
): Promise<FacelessClassification> {
  const classification = await classifyChannel(input);

  const { error } = await admin
    .from("niche_channels")
    .update({
      is_faceless: classification.is_faceless,
      faceless_confidence: classification.confidence_score,
      faceless_category: classification.faceless_category,
      complexity: classification.complexity,
      viral_velocity_score: classification.viral_velocity_score,
      classification_reasoning: classification.reasoning,
      verified_at: new Date().toISOString(),
    })
    .eq("id", channelId);

  if (error) {
    throw new FacelessClassifierError(`Failed to store classification for channel ${channelId}: ${error.message}`);
  }

  return classification;
}
