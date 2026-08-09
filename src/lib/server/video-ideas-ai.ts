import { generateObject } from "ai";
import { z } from "zod";
import { OPENROUTER_MAX_OUTPUT_TOKENS, openrouterInstructModel } from "./openrouter-client";

export class VideoIdeasAiError extends Error {}

const SYSTEM_PROMPT = `You are Verlab's short-form video ideation strategist: an expert at turning one real, high-performing TikTok/YouTube video into fresh, actionable video concepts for a faceless-content creator working in the same niche. Every idea must be a distinct angle inspired by (not a copy of) the source video's hook and format -- concrete enough that a creator could start production from it today. No generic content-creator platitudes; every description, production note, and hashtag must be specific to the niche and format implied by the source video.`;

const VideoIdeaSchema = z.object({
  title: z.string().describe("A punchy, clickable video title, 6-12 words"),
  emoji: z.string().describe("A single emoji that fits the title's tone"),
  description: z.string().describe("2-3 sentences describing the concept, hook, and why it would perform"),
  targetAudience: z.string().describe("Who this specific video is for, 3-8 words"),
  productionNotes: z.array(z.string()).min(2).max(4).describe("Concrete, actionable production/editing tips"),
  hashtags: z.array(z.string()).min(3).max(6).describe("Hashtags without the # symbol"),
});

const VideoIdeasResultSchema = z.object({
  ideas: z.array(VideoIdeaSchema).length(4),
});

export type VideoIdea = z.infer<typeof VideoIdeaSchema>;

export interface VideoIdeaSourceContext {
  niche: string;
  title: string;
  viewCount: number;
  velocity: number;
  outlierIndex: number;
}

export async function generateVideoIdeas(context: VideoIdeaSourceContext): Promise<VideoIdea[]> {
  const prompt = `Source video:
- Niche: ${context.niche}
- Title/caption: "${context.title}"
- Views: ${context.viewCount.toLocaleString()}
- Velocity: ${Math.round(context.velocity).toLocaleString()} views/day since posting
- Outlier index: ${context.outlierIndex}% (engagement percentile among niche peers)

Generate exactly 4 distinct video concepts for this niche, each inspired by a different angle on what makes the source video work (its hook style, pacing, or format) -- not variations of the same idea.`;

  try {
    const { object } = await generateObject({
      model: openrouterInstructModel,
      system: SYSTEM_PROMPT,
      prompt,
      schema: VideoIdeasResultSchema,
      maxOutputTokens: Math.min(2000, OPENROUTER_MAX_OUTPUT_TOKENS),
    });
    // The model doesn't always honor "no spaces in hashtags" -- strip them
    // rather than trust prompt compliance, since a hashtag pill with a
    // space in it (e.g. "#role reversal") renders as visibly broken.
    return object.ideas.map((idea) => ({
      ...idea,
      hashtags: idea.hashtags.map((tag) => tag.replace(/^#/, "").replace(/\s+/g, "")).filter(Boolean),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new VideoIdeasAiError(`OpenRouter request failed: ${message}`);
  }
}
