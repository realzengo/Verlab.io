import { z } from "zod";
import type { ModelMessage } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserCredits, chargeUser, refundUser, InsufficientCreditsError } from "@/lib/server/credits";
import { recordUsageEvent } from "@/lib/server/usage";
import { TOOL_CREDIT_COSTS, getImageGenerationCost, slugifyModelName } from "@/lib/config/pricing";
import { generateScriptText, buildSystemPrompt } from "@/lib/server/script-generation";
import { generateImages, IMAGE_MODEL_MAP, resolveQualityModel } from "@/lib/server/cloudflare-image";
import {
  fetchTranscript,
  fetchDownloadLink,
  detectTranscriptPlatform,
  detectDownloadPlatform,
  humanizeVideoProviderError,
} from "@/lib/server/video-provider";
import { getNicheVideosPage } from "@/lib/server/niche-video-query";
import { isNicheName } from "@/lib/niches-catalog";
import { researchViralNiches, type NicheFinderAnswers, type NicheReportEntry } from "@/lib/server/niche-report-ai";
import { DOWNLOAD_FORMAT_OPTIONS, getDownloadFormatOption, type DownloadFormat, type NicheBendChannelAnalysis } from "@/lib/types";
import { signThumbUrl } from "@/lib/server/mcp/thumb-proxy";
import {
  scrapeChannelVideosWithUrls,
  detectCreatorPlatform,
  fetchTranscriptsBounded,
} from "@/lib/server/apify-client";
import { analyzeCreatorTranscripts, buildCreatorAnalysisDocx, type CreatorAnalysis } from "@/lib/server/creator-analysis";
import { describeGenerationFailure } from "@/lib/server/generation-error";

// Every tool below is scoped to a single Verlab user (`userId`, resolved
// from the MCP connector token by verifyMcpToken — see mcp-auth.ts). There
// is no cookie session on this path, so all DB access goes through the
// service-role client rather than the per-request client the web app's API
// routes use.
//
// Credit costs are never re-derived here — always imported from
// src/lib/config/pricing.ts / applied via src/lib/server/credits.ts, the
// same primitives the web routes use, so MCP and web charges can never
// drift apart.

// Every tool result is rendered as a branded MCP App widget (see
// src/lib/server/mcp/apps/) rather than plain text -- `structuredContent` is
// what the widget's `ontoolresult` handler reads, while `text` remains the
// fallback for hosts without MCP Apps support.
function appResult(text: string, structuredContent: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], structuredContent };
}

function jsonResult(data: Record<string, unknown>) {
  return appResult(JSON.stringify(data, null, 2), data);
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

// Bounded wait before an async job (image/transcript/download) falls back to
// "still processing" — MCP tool calls can hold the connection open longer
// than a browser tab, but Claude/ChatGPT's own per-call timeout isn't
// something Verlab controls, so results are returned as soon as they're
// ready rather than always waiting the full budget.
const ASYNC_TOOL_BUDGET_MS = 55_000;

async function withBudget<T>(work: Promise<T>, budgetMs: number): Promise<T | "timeout"> {
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), budgetMs));
  return Promise.race([work, timeout]);
}

type McpToolResult = ReturnType<typeof appResult> | ReturnType<typeof errorResult>;

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  handler: (userId: string, args: Record<string, unknown>) => Promise<McpToolResult>;
}

const getCreditBalanceTool: McpToolDefinition = {
  name: "get_credit_balance",
  title: "Get credit balance",
  description: "Returns the Verlab account's current credit balance.",
  inputSchema: {},
  handler: async (userId) => {
    const credits = await getUserCredits(userId);
    return jsonResult({ credits });
  },
};

const listScriptsTool: McpToolDefinition = {
  name: "list_scripts",
  title: "List generated scripts",
  description: "Lists the most recent scripts generated on this Verlab account (up to 100).",
  inputSchema: {},
  handler: async (userId) => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("scripts")
      .select("id, prompt, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return errorResult(error.message);
    return jsonResult({ scripts: data });
  },
};

const listLibraryTool: McpToolDefinition = {
  name: "list_library",
  title: "List library assets",
  description: "Lists saved images and SOPs in this Verlab account's library.",
  inputSchema: {
    type: z.enum(["all", "image", "sop"]).optional().describe("Filter by asset type. Defaults to all."),
  },
  handler: async (userId, args) => {
    const type = (args.type as "all" | "image" | "sop" | undefined) ?? "all";
    const admin = createAdminClient();
    const wantsImages = type === "all" || type === "image";
    const wantsSops = type === "all" || type === "sop";

    const [imagesResult, sopsResult] = await Promise.all([
      wantsImages
        ? admin
            .from("image_generations")
            .select("id, prompt, model, outputs, created_at")
            .eq("user_id", userId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [] as never[], error: null }),
      wantsSops
        ? admin
            .from("niche_bend_jobs")
            .select("id, analysis, created_at")
            .eq("user_id", userId)
            .eq("saved", true)
            .order("created_at", { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [] as never[], error: null }),
    ]);

    if (imagesResult.error) return errorResult(imagesResult.error.message);
    if (sopsResult.error) return errorResult(sopsResult.error.message);

    return jsonResult({
      images: imagesResult.data,
      sops: sopsResult.data.map((row) => {
        const analysis = row.analysis as NicheBendChannelAnalysis | null;
        return {
          id: row.id,
          created_at: row.created_at,
          channelName: analysis?.channelName ?? null,
          detectedNiche: analysis?.detectedNiche ?? null,
          topVideos: analysis?.topVideos ?? [],
        };
      }),
    });
  },
};

const browseNicheVideosTool: McpToolDefinition = {
  name: "browse_niche_videos",
  title: "Browse trending niche videos",
  description:
    "Browses Verlab's cached trending TikTok/YouTube videos for a SPECIFIC niche the user already named (e.g. " +
    "'History', 'Crime', 'Finance'), or 'all' niches blended together as a raw feed. Useful for researching what's " +
    "currently working in a niche the user already picked, before writing a script. Do NOT use this for an " +
    "open-ended 'find me a niche' / 'what niche should I start' / 'help me pick a niche' request -- use find_niche " +
    "for that instead, even if you could technically answer with niche='all' here. This tool has no concept of " +
    "the user's own interests/background/budget; find_niche does.",
  inputSchema: {
    niche: z.string().describe("A niche name (see Verlab's niche list) or 'all'."),
    platform: z.enum(["tiktok", "youtube", "all"]).optional().describe("Defaults to all."),
    page: z.number().int().min(1).optional().describe("Defaults to 1."),
    limit: z.number().int().min(1).max(50).optional().describe("Defaults to 20."),
  },
  handler: async (_userId, args) => {
    const niche = String(args.niche ?? "all");
    const isAllNiches = niche === "all";
    if (!isAllNiches && !isNicheName(niche)) {
      return errorResult(`Unknown niche "${niche}"`);
    }

    const platform = args.platform === "tiktok" || args.platform === "youtube" ? args.platform : "all";
    const page = Math.max(1, Number(args.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));

    const result = await getNicheVideosPage(niche, isAllNiches, {
      page,
      limit,
      style: "all",
      platform,
      timeWindow: "all",
      country: "",
      viewsMin: null,
      viewsMax: null,
      followersMin: null,
      followersMax: null,
      postedAfter: null,
      postedBefore: null,
      q: null,
      sort: "views",
    });

    return jsonResult({
      ...result,
      videos: result.videos.map((video) => ({
        ...video,
        coverUrl: signThumbUrl(video.coverUrl),
        avatarUrl: signThumbUrl(video.avatarUrl),
      })),
    });
  },
};

const NICHE_REPORT_PLATFORMS = ["youtube", "tiktok", "both"] as const;
const NICHE_FINDER_FORMATS = ["long-form", "shorts", "not-sure"] as const;
const NICHE_FINDER_STYLES = ["ai-visuals", "animation", "real-footage", "no-preference"] as const;

interface EnrichedSampleVideo {
  title: string;
  views: string;
  coverUrl: string | null;
  videoUrl: string | null;
  author: string | null;
  avatarUrl: string | null;
}

// The live/fallback research pass only ever returns text (title + view
// count) for sampleVideos -- it has no real thumbnails. When a niche maps
// onto one of Verlab's own tracked categories (see trackedNiche in
// niche-report-ai.ts), swap in real cached videos with real screenshots
// from the same cache browse_niche_videos uses; otherwise leave the
// research pass's text-only examples as-is (with null image fields).
async function enrichNicheWithRealVideos(
  niche: NicheReportEntry
): Promise<Omit<NicheReportEntry, "trackedNiche"> & { sampleVideos: EnrichedSampleVideo[] }> {
  const { trackedNiche, ...publicFields } = niche;
  const textOnly: EnrichedSampleVideo[] = niche.sampleVideos.map((video) => ({
    ...video,
    coverUrl: null,
    videoUrl: null,
    author: null,
    avatarUrl: null,
  }));

  if (trackedNiche === "none" || !isNicheName(trackedNiche)) {
    return { ...publicFields, sampleVideos: textOnly };
  }

  const page = await getNicheVideosPage(trackedNiche, false, {
    page: 1,
    limit: 4,
    style: "all",
    platform: niche.platform === "both" ? "all" : niche.platform,
    timeWindow: "all",
    country: "",
    viewsMin: null,
    viewsMax: null,
    followersMin: null,
    followersMax: null,
    postedAfter: null,
    postedBefore: null,
    q: null,
    sort: "views",
  });

  if (page.videos.length === 0) return { ...publicFields, sampleVideos: textOnly };

  const realVideos: EnrichedSampleVideo[] = page.videos.slice(0, 4).map((video) => ({
    title: video.title,
    views: video.views,
    coverUrl: signThumbUrl(video.coverUrl),
    videoUrl: video.videoUrl,
    author: video.author,
    avatarUrl: signThumbUrl(video.avatarUrl),
  }));

  return { ...publicFields, sampleVideos: realVideos };
}

const findNicheTool: McpToolDefinition = {
  name: "find_niche",
  title: "Find a content niche",
  description:
    "THE tool for 'find me a niche', 'what niche should I start', 'help me pick a niche', or any other open-ended " +
    "request to find/pick/suggest a content niche -- call this immediately for those, even a bare one-line " +
    "request, rather than answering from browse_niche_videos or your own reasoning. Opens an interactive form " +
    "asking the user seven quick questions -- what they could talk about for hours, channels they already watch, " +
    "YouTube or TikTok, long-form vs Shorts, how they want videos made, any background/skill to pull from, and " +
    "monthly budget -- then researches what's actually going viral right now on their chosen platform and returns " +
    "a full niche report (5-7 niches, each with real current example videos, a momentum score/trend, and a " +
    "personalized starter angle). Call with no arguments to show the form (free); " +
    "the widget calls this same tool again with the filled-in answers once the user submits, which kicks off the " +
    "research and charges credits (see get_credit_balance) -- that can take up to a couple minutes, so a " +
    "'processing' result means poll check_niche_report_status with the returned id until it's done. Also " +
    "callable directly with answers already filled in if the user just describes themselves in chat instead of " +
    "using the form. Use when the user wants help finding, picking, or narrowing down a YouTube/TikTok niche to " +
    "start a channel in, or wants to know what niches are trending/going viral right now.",
  inputSchema: {
    interests: z.string().optional().describe("What they could talk about for hours -- obsessions, rabbit holes, stuff they already know too much about."),
    channelsTheyLike: z.string().optional().describe("Channels/creators they already watch or like, names or @handles."),
    platform: z.enum(NICHE_REPORT_PLATFORMS).optional().describe("YouTube, TikTok, or both. Defaults to both."),
    format: z.enum(NICHE_FINDER_FORMATS).optional().describe("Long-form or Shorts. Defaults to not-sure."),
    productionStyle: z.enum(NICHE_FINDER_STYLES).optional().describe("How they want the videos made. Defaults to no-preference."),
    background: z.string().optional().describe("Any job, background, or skill to pull from."),
    budget: z.number().optional().describe("Monthly production budget in USD."),
  },
  handler: async (userId, args) => {
    const interests = String(args.interests ?? "").trim();
    const channelsTheyLike = String(args.channelsTheyLike ?? "").trim();
    const background = String(args.background ?? "").trim();

    // Nothing to research yet -- this is the initial call that just opens
    // the form. The widget re-calls this same tool (via app.callServerTool)
    // with real answers once the user hits submit.
    if (!interests && !channelsTheyLike) {
      return jsonResult({ stage: "form" });
    }

    const platform = (NICHE_REPORT_PLATFORMS as readonly string[]).includes(String(args.platform))
      ? (args.platform as (typeof NICHE_REPORT_PLATFORMS)[number])
      : "both";
    const format = (NICHE_FINDER_FORMATS as readonly string[]).includes(String(args.format))
      ? (args.format as (typeof NICHE_FINDER_FORMATS)[number])
      : "not-sure";
    const productionStyle = (NICHE_FINDER_STYLES as readonly string[]).includes(String(args.productionStyle))
      ? (args.productionStyle as (typeof NICHE_FINDER_STYLES)[number])
      : "no-preference";
    const budgetNum = Number(args.budget);
    const budget = Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : null;

    const answers: NicheFinderAnswers = { interests, channelsTheyLike, platform, format, productionStyle, background, budget };

    const cost = TOOL_CREDIT_COSTS.niches.findNiche;
    const balance = await getUserCredits(userId);
    if (balance < cost) return errorResult("Insufficient credits");

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("niche_reports")
      .insert({ user_id: userId, platform, answers, status: "processing" })
      .select("id")
      .single();

    if (insertError || !row) return errorResult(insertError?.message ?? "Could not start the niche report");

    const work = (async () => {
      const { niches: rawNiches, live } = await researchViralNiches(answers);
      const niches = await Promise.all(rawNiches.map(enrichNicheWithRealVideos));
      await chargeUser(userId, cost, "Niche Finder Research", "niches.find_niche");
      await admin.from("niche_reports").update({ status: "complete", niches, live }).eq("id", row.id);
      recordUsageEvent("mcp", userId, { action: "nicheReport.research", reportId: row.id, live });
      return { niches, live };
    })();

    const outcome = await withBudget(work, ASYNC_TOOL_BUDGET_MS);

    if (outcome === "timeout") {
      return jsonResult({
        stage: "processing",
        id: row.id,
        platform,
        // The widget polls check_niche_report_status itself and updates in place --
        // telling the calling model to also call it would just spawn duplicate
        // "processing" widget cards in the chat on top of the one already polling.
        note: "Still researching. The report will appear in the widget above once it's ready, no need to check again.",
      });
    }

    work.catch(async (error) => {
      await admin
        .from("niche_reports")
        .update({ status: "failed", error_message: error instanceof Error ? error.message : "Research failed" })
        .eq("id", row.id);
    });

    return jsonResult({ stage: "result", id: row.id, platform, niches: outcome.niches, live: outcome.live });
  },
};

const checkNicheReportStatusTool: McpToolDefinition = {
  name: "check_niche_report_status",
  title: "Check niche report status",
  description: "Checks the status of an in-progress find_niche research call by its id.",
  inputSchema: { id: z.string() },
  handler: async (userId, args) => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("niche_reports")
      .select("id, status, platform, niches, live, error_message")
      .eq("id", String(args.id))
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return errorResult("Not found");
    if (data.status === "failed") return jsonResult({ stage: "error", error_message: data.error_message ?? "Research failed" });
    if (data.status === "processing") {
      return jsonResult({
        stage: "processing",
        id: data.id,
        platform: data.platform,
        note: "Still researching. The widget polls this automatically and will show the report once it's ready, no need to check again.",
      });
    }
    return jsonResult({ stage: "result", id: data.id, platform: data.platform, niches: data.niches, live: data.live });
  },
};

const generateScriptTool: McpToolDefinition = {
  name: "generate_script",
  title: "Generate a script",
  description:
    "Generates a short-form video script (or 10 video ideas) by applying a competitor's SOP and example transcripts to a new topic. Charges credits (see get_credit_balance).",
  inputSchema: {
    message: z.string().describe("The topic, or an instruction like 'give me 10 ideas' or 'script this'."),
    sop: z.string().optional().describe("The competitor channel's SOP/style notes, if known."),
    transcripts: z.string().optional().describe("Example transcripts from the competitor channel, if known."),
  },
  handler: async (userId, args) => {
    const message = String(args.message ?? "").trim();
    if (!message) return errorResult("message is required");

    const cost = TOOL_CREDIT_COSTS.script.generation;
    try {
      await chargeUser(userId, cost, "Script Generation", "script.generation");
    } catch (error) {
      if (error instanceof InsufficientCreditsError) return errorResult("Insufficient credits");
      throw error;
    }

    const systemPrompt = buildSystemPrompt(
      String(args.sop ?? "").trim() || "No SOP provided.",
      String(args.transcripts ?? "").trim() || "No transcripts provided.",
      message
    );
    const messages: ModelMessage[] = [{ role: "user", content: message }];

    try {
      const text = await generateScriptText(systemPrompt, messages);
      const admin = createAdminClient();
      const { data: row } = await admin
        .from("scripts")
        .insert({ user_id: userId, prompt: message, content: text })
        .select("id")
        .single();
      recordUsageEvent("mcp", userId, { action: "script.generation" });
      return appResult(text, { text, cost, id: row?.id ?? "" });
    } catch (error) {
      await refundUser(userId, cost, "Script Generation refund", "script.generation");
      return errorResult(error instanceof Error ? error.message : "Script generation failed");
    }
  },
};

const IMAGE_MODELS = Object.keys(IMAGE_MODEL_MAP);
const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"] as const;

const generateImageTool: McpToolDefinition = {
  name: "generate_image",
  title: "Generate an image",
  description: "Generates one or more AI images from a text prompt. Charges credits (see get_credit_balance).",
  inputSchema: {
    prompt: z.string().describe("What to generate."),
    model: z.enum(IMAGE_MODELS as [string, ...string[]]).describe("Which image model to use."),
    aspectRatio: z.enum(ASPECT_RATIOS).optional().describe("Defaults to 1:1."),
    outputs: z.number().int().min(1).max(4).optional().describe("Number of images, 1-4. Defaults to 1."),
    quality: z.enum(["auto", "low", "medium", "high"]).optional().describe("Defaults to auto."),
    resolution: z.enum(["512px", "1K", "2K", "4K"]).optional().describe("Defaults to 1K."),
  },
  handler: async (userId, args) => {
    const prompt = String(args.prompt ?? "").trim();
    if (!prompt) return errorResult("prompt is required");

    const model = String(args.model ?? "");
    if (!(model in IMAGE_MODEL_MAP)) return errorResult("model must be one of the supported options");

    const aspectRatio = (args.aspectRatio as string) ?? "1:1";
    const outputs = Math.min(4, Math.max(1, Number(args.outputs) || 1));
    const quality = (args.quality as "auto" | "low" | "medium" | "high") ?? "auto";
    const resolution = (args.resolution as "512px" | "1K" | "2K" | "4K") ?? "1K";

    const resolvedModel = resolveQualityModel(model, quality);
    const cost = getImageGenerationCost({
      model: resolvedModel,
      resolution,
      quality,
      outputs,
      hasReferenceImage: false,
    });

    const balance = await getUserCredits(userId);
    if (balance < cost) return errorResult("Insufficient credits");

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("image_generations")
      .insert({ user_id: userId, prompt, model, aspect_ratio: aspectRatio, outputs, images: [], status: "generating" })
      .select("id")
      .single();

    if (insertError || !row) return errorResult(insertError?.message ?? "Could not start generation");

    const work = (async () => {
      const images = await generateImages({ prompt, model, aspectRatio, outputs, quality, resolution });
      await chargeUser(userId, cost, "Image Generation", `image.${slugifyModelName(resolvedModel)}`);
      await admin.from("image_generations").update({ images, status: "completed" }).eq("id", row.id);
      recordUsageEvent("image", userId, { model, aspectRatio, outputs, source: "mcp" });
      return images;
    })();

    const outcome = await withBudget(work, ASYNC_TOOL_BUDGET_MS);

    if (outcome === "timeout") {
      return jsonResult({
        id: row.id,
        status: "generating",
        // The widget polls check_image_status itself and updates in place --
        // telling the calling model to also call it would just spawn duplicate
        // "generating" widget cards in the chat on top of the one already polling.
        note: "Still generating. The image will appear in the widget above once it's ready, no need to check again.",
      });
    }

    work.catch(async (error) => {
      await admin
        .from("image_generations")
        .update({ status: "failed", ...describeGenerationFailure("mcp/generate_image", error) })
        .eq("id", row.id);
    });

    return jsonResult({ id: row.id, status: "completed", images: outcome });
  },
};

const checkImageStatusTool: McpToolDefinition = {
  name: "check_image_status",
  title: "Check image generation status",
  description: "Checks the status of an in-progress generate_image call by its id.",
  inputSchema: { id: z.string() },
  handler: async (userId, args) => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("image_generations")
      .select("id, status, images, error_message")
      .eq("id", String(args.id))
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return errorResult("Not found");
    return jsonResult(data);
  },
};

const extractTranscriptTool: McpToolDefinition = {
  name: "extract_transcript",
  title: "Extract a video transcript",
  description:
    "Extracts the transcript (with timestamps) from a TikTok, Instagram Reels, or YouTube URL (Shorts or long-form). Charges credits (see get_credit_balance).",
  inputSchema: { url: z.string().describe("A TikTok, Instagram Reels, or YouTube URL.") },
  handler: async (userId, args) => {
    const url = String(args.url ?? "").trim();
    if (!url) return errorResult("url is required");

    const platform = detectTranscriptPlatform(url);
    if (!platform) return errorResult("Only TikTok, Instagram Reels, and YouTube links are supported");

    const cost = TOOL_CREDIT_COSTS.transcripts.extract;
    try {
      await chargeUser(userId, cost, "Transcript Extraction", "transcripts.extract");
    } catch (error) {
      if (error instanceof InsufficientCreditsError) return errorResult("Insufficient credits");
      throw error;
    }

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("transcripts")
      .insert({ user_id: userId, source_url: url, platform, status: "processing" })
      .select("id")
      .single();

    if (insertError || !row) {
      await refundUser(userId, cost, "Transcript Extraction refund", "transcripts.extract");
      return errorResult(insertError?.message ?? "Could not start extraction");
    }

    const work = (async () => {
      const result = await fetchTranscript(url);
      await admin
        .from("transcripts")
        .update({
          status: "complete",
          title: result.title,
          cover_url: result.coverUrl,
          duration_seconds: result.durationSeconds,
          video_url: result.videoUrl,
          embed_url: result.embedUrl,
          lines: result.lines,
        })
        .eq("id", row.id);
      recordUsageEvent("transcripts", userId, { transcriptId: row.id, source: "mcp" });
      return result;
    })();

    const outcome = await withBudget(work, ASYNC_TOOL_BUDGET_MS);

    if (outcome === "timeout") {
      return jsonResult({
        id: row.id,
        status: "processing",
        note: "Still extracting. Call check_transcript_status with this id shortly.",
      });
    }

    work.catch(async (error) => {
      await admin
        .from("transcripts")
        .update({ status: "failed", error_message: humanizeVideoProviderError(error) })
        .eq("id", row.id);
    });

    return jsonResult({ id: row.id, status: "complete", ...outcome, coverUrl: signThumbUrl(outcome.coverUrl) });
  },
};

const checkTranscriptStatusTool: McpToolDefinition = {
  name: "check_transcript_status",
  title: "Check transcript extraction status",
  description: "Checks the status of an in-progress extract_transcript call by its id.",
  inputSchema: { id: z.string() },
  handler: async (userId, args) => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("transcripts")
      .select("id, status, title, cover_url, video_url, embed_url, lines, error_message")
      .eq("id", String(args.id))
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return errorResult("Not found");
    const { cover_url, video_url, embed_url, ...rest } = data;
    return jsonResult({
      ...rest,
      coverUrl: signThumbUrl(cover_url),
      videoUrl: video_url,
      embedUrl: embed_url,
    });
  },
};

const DOWNLOAD_FORMATS = DOWNLOAD_FORMAT_OPTIONS.map((option) => option.value) as [DownloadFormat, ...DownloadFormat[]];

const downloadVideoTool: McpToolDefinition = {
  name: "download_video",
  title: "Download a video",
  description:
    "Downloads a TikTok, YouTube, or Facebook video (or extracts its audio) and returns a direct file URL. Charges credits (see get_credit_balance). Format options: " +
    DOWNLOAD_FORMAT_OPTIONS.map((option) => `${option.value} (${option.label})`).join(", "),
  inputSchema: {
    url: z.string().describe("A TikTok, YouTube, or Facebook URL."),
    format: z.enum(DOWNLOAD_FORMATS).optional().describe("Defaults to 720 (MP4 720p)."),
  },
  handler: async (userId, args) => {
    const url = String(args.url ?? "").trim();
    if (!url) return errorResult("url is required");

    const formatOption = getDownloadFormatOption(String(args.format ?? "720"));
    if (!formatOption) return errorResult("Unsupported format");
    const format: DownloadFormat = formatOption.value;

    const platform = detectDownloadPlatform(url);
    if (!platform) return errorResult("Only TikTok, YouTube, and Facebook links are supported");

    const cost = TOOL_CREDIT_COSTS.downloads.create;
    try {
      await chargeUser(userId, cost, "Video Download", "downloads.create");
    } catch (error) {
      if (error instanceof InsufficientCreditsError) return errorResult("Insufficient credits");
      throw error;
    }

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("downloads")
      .insert({ user_id: userId, source_url: url, platform, format, status: "processing" })
      .select("id")
      .single();

    if (insertError || !row) {
      await refundUser(userId, cost, "Video Download refund", "downloads.create");
      return errorResult(insertError?.message ?? "Could not start download");
    }

    const work = (async () => {
      const result = await fetchDownloadLink(url, format, (percent) => {
        void admin.from("downloads").update({ progress: percent }).eq("id", row.id);
      });
      await admin
        .from("downloads")
        .update({ status: "complete", progress: 100, title: result.title, file_path: result.directUrl })
        .eq("id", row.id);
      recordUsageEvent("downloader", userId, { downloadId: row.id, source: "mcp" });
      return result;
    })();

    const outcome = await withBudget(work, ASYNC_TOOL_BUDGET_MS);

    if (outcome === "timeout") {
      return jsonResult({
        id: row.id,
        status: "processing",
        note: "Still downloading. Call check_download_status with this id shortly.",
      });
    }

    work.catch(async (error) => {
      await admin
        .from("downloads")
        .update({ status: "failed", error_message: humanizeVideoProviderError(error) })
        .eq("id", row.id);
    });

    return jsonResult({ id: row.id, status: "complete", title: outcome.title, url: outcome.directUrl });
  },
};

const checkDownloadStatusTool: McpToolDefinition = {
  name: "check_download_status",
  title: "Check video download status",
  description: "Checks the status of an in-progress download_video call by its id.",
  inputSchema: { id: z.string() },
  handler: async (userId, args) => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("downloads")
      .select("id, status, progress, title, file_path, error_message")
      .eq("id", String(args.id))
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return errorResult("Not found");
    return jsonResult(data);
  },
};

const CREATOR_ANALYSIS_VIDEO_COUNT = 5;
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "Creator";
}

// Shared by the initial analyze_creator call and check_creator_analysis_status
// once the job is complete -- the text field is what the calling model
// (Claude/ChatGPT) actually reads, so it carries an explicit, actionable
// instruction to turn the branded .docx in structuredContent.docBase64 into a
// real Google Doc via the host's own Google Drive connector, rather than
// Verlab's backend holding a Google OAuth/service-account integration itself.
function creatorAnalysisCompleteResult(params: {
  id: string;
  channelName: string;
  videos: { title: string; views: string; url: string }[];
  analysis: CreatorAnalysis;
  docBase64: string;
  docFilename: string;
}): McpToolResult {
  const { id, channelName, videos, analysis, docBase64, docFilename } = params;
  const text =
    `Creator analysis for ${channelName} is complete (${videos.length} videos analyzed).\n\n` +
    `${analysis.executiveSummary}\n\n` +
    "A full branded report is ready to hand to the user as a Google Doc: structuredContent.docBase64 is a " +
    "base64-encoded .docx file (filename in structuredContent.docFilename, mime type in structuredContent.docMimeType). " +
    "If the user has Google Drive connected, create it now by calling Google Drive's create_file tool with " +
    "title=docFilename, base64Content=docBase64, contentMimeType=docMimeType (leave conversion enabled) -- Drive " +
    "will auto-convert the Word document into a native Google Doc. Then share the resulting file's link with the " +
    "user so they can view it inside Claude or download it from Drive. If Google Drive isn't connected, offer the " +
    "analysis inline instead and mention that a branded .docx report is available.";

  return appResult(text, {
    id,
    status: "complete",
    channelName,
    videos,
    summary: analysis.executiveSummary,
    analysis,
    docBase64,
    docFilename,
    docMimeType: DOCX_MIME_TYPE,
  });
}

const analyzeCreatorTool: McpToolDefinition = {
  name: "analyze_creator",
  title: "Analyze a creator's content strategy",
  description:
    "Deep-dive analysis of ONE specific TikTok or YouTube creator's content strategy: scrapes their top " +
    `${CREATOR_ANALYSIS_VIDEO_COUNT} highest-viewed videos, extracts the real transcripts from each, and writes ` +
    "up how they structure hooks, pacing, and delivery -- grounded in the actual transcript text, with real view " +
    "counts per video. Use this when the user wants to reverse-engineer, copy, 'steal', or study what makes a " +
    "specific creator's content work (e.g. 'analyze this creator', 'break down their style', 'steal their " +
    "content'). Different from browse_niche_videos, which surveys many different creators across a whole niche " +
    "rather than one creator's own catalog in depth. The result includes a full branded analysis report as a " +
    "base64-encoded .docx (see the result's own instructions) -- if the caller has Google Drive connected, upload " +
    "it there to hand the user a real Google Doc they can view or download. Charges credits (see get_credit_balance).",
  inputSchema: { url: z.string().describe("A TikTok or YouTube creator/channel profile URL.") },
  handler: async (userId, args) => {
    const url = String(args.url ?? "").trim();
    if (!url) return errorResult("url is required");

    const platform = detectCreatorPlatform(url);
    if (!platform) return errorResult("Only TikTok and YouTube channel/profile links are supported");

    const cost = TOOL_CREDIT_COSTS.creatorAnalysis.analyze;
    try {
      await chargeUser(userId, cost, "Creator Analysis", "creatorAnalysis.analyze");
    } catch (error) {
      if (error instanceof InsufficientCreditsError) return errorResult("Insufficient credits");
      throw error;
    }

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("creator_analyses")
      .insert({ user_id: userId, source_url: url, platform, status: "processing" })
      .select("id")
      .single();

    if (insertError || !row) {
      await refundUser(userId, cost, "Creator Analysis refund", "creatorAnalysis.analyze");
      return errorResult(insertError?.message ?? "Could not start analysis");
    }

    const work = (async () => {
      // Pinned to "shorts" to preserve this tool's existing behavior exactly
      // (it predates long-form support in scrapeChannelVideosWithUrls).
      const channel = await scrapeChannelVideosWithUrls(url, platform, "shorts", CREATOR_ANALYSIS_VIDEO_COUNT);
      const transcribed = await fetchTranscriptsBounded(channel.videos, 2);
      if (transcribed.length === 0) {
        throw new Error("Could not extract a transcript from any of this creator's top videos.");
      }

      const videos = channel.videos.map((video) => ({ title: video.title, views: video.views, url: video.url }));
      const analysis = await analyzeCreatorTranscripts(
        channel.channelName,
        transcribed.map(({ video, text }) => ({ title: video.title, views: video.views, text }))
      );

      const docFilename = `${sanitizeFilename(channel.channelName)}, Content Strategy Analysis.docx`;
      const docBuffer = await buildCreatorAnalysisDocx(channel.channelName, url, platform, videos, analysis);
      const docBase64 = docBuffer.toString("base64");

      await admin
        .from("creator_analyses")
        .update({
          status: "complete",
          channel_name: channel.channelName,
          videos,
          summary: analysis.executiveSummary,
          analysis,
          doc_base64: docBase64,
          doc_filename: docFilename,
        })
        .eq("id", row.id);
      recordUsageEvent("mcp", userId, { action: "creatorAnalysis.analyze", analysisId: row.id });
      return { channelName: channel.channelName, videos, analysis, docBase64, docFilename };
    })();

    const outcome = await withBudget(work, ASYNC_TOOL_BUDGET_MS);

    if (outcome === "timeout") {
      return jsonResult({
        id: row.id,
        status: "processing",
        note: "Still analyzing. Call check_creator_analysis_status with this id shortly.",
      });
    }

    work.catch(async (error) => {
      // Unlike the other async tools' late-failure paths (which only mark
      // the row failed), this one refunds -- the flat cost here (~5
      // transcripts + an LLM call) is high enough that a failed job
      // shouldn't just eat the user's credits with nothing to show for it.
      await admin
        .from("creator_analyses")
        .update({ status: "failed", error_message: error instanceof Error ? error.message : "Analysis failed" })
        .eq("id", row.id);
      await refundUser(userId, cost, "Creator Analysis refund", "creatorAnalysis.analyze");
    });

    return creatorAnalysisCompleteResult({ id: row.id, ...outcome });
  },
};

const checkCreatorAnalysisStatusTool: McpToolDefinition = {
  name: "check_creator_analysis_status",
  title: "Check creator analysis status",
  description: "Checks the status of an in-progress analyze_creator call by its id.",
  inputSchema: { id: z.string() },
  handler: async (userId, args) => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("creator_analyses")
      .select("id, status, channel_name, videos, analysis, doc_base64, doc_filename, error_message")
      .eq("id", String(args.id))
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return errorResult("Not found");
    if (data.status !== "complete") {
      return jsonResult({
        id: data.id,
        status: data.status,
        error_message: data.error_message ?? undefined,
        note: data.status === "processing" ? "Still analyzing. Try again shortly." : undefined,
      });
    }

    return creatorAnalysisCompleteResult({
      id: data.id,
      channelName: data.channel_name ?? "Creator",
      videos: (data.videos as { title: string; views: string; url: string }[] | null) ?? [],
      analysis: data.analysis as CreatorAnalysis,
      docBase64: data.doc_base64 ?? "",
      docFilename: data.doc_filename ?? "Creator Analysis.docx",
    });
  },
};

export const MCP_TOOLS: McpToolDefinition[] = [
  getCreditBalanceTool,
  listScriptsTool,
  listLibraryTool,
  browseNicheVideosTool,
  findNicheTool,
  checkNicheReportStatusTool,
  generateScriptTool,
  generateImageTool,
  checkImageStatusTool,
  extractTranscriptTool,
  checkTranscriptStatusTool,
  downloadVideoTool,
  checkDownloadStatusTool,
  analyzeCreatorTool,
  checkCreatorAnalysisStatusTool,
];
