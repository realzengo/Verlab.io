import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeUser, refundUser } from "@/lib/server/credits";
import { recordUsageEvent } from "@/lib/server/usage";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { getNicheVideosPage } from "@/lib/server/niche-video-query";
import { isNicheName, NICHE_ORDER } from "@/lib/niches-catalog";
import { researchViralNiches, type NicheFinderAnswers, type NicheReportEntry } from "@/lib/server/niche-report-ai";
import { scrapeChannelVideosWithUrls, detectCreatorPlatform, fetchTranscriptsBounded } from "@/lib/server/apify-client";
import { analyzeCreatorTranscripts, buildCreatorAnalysisDocx, type CreatorAnalysis } from "@/lib/server/creator-analysis";
import { requireNicheFinderAccess } from "@/lib/server/subscription";
import { APP_LINKS, signMediaUrl } from "../links";
import { signThumbUrl } from "../thumb-proxy";
import {
  appResult,
  chargeUpfront,
  CREATES,
  errorMessage,
  errorResult,
  POLLING_NOTE,
  READ_ONLY,
  requireCredits,
  runJob,
  STATUS_CHECK,
  UUID_PATTERN,
  type McpToolDefinition,
  type McpToolResult,
} from "./shared";

const NICHE_QUERY_DEFAULTS = {
  style: "all",
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
} as const;

/** Niche Finder is a Pro/Scale feature (same rule as /niches and its API routes). Null means allowed. */
async function nicheFinderBlock(userId: string): Promise<McpToolResult | null> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  if (await requireNicheFinderAccess(admin, { id: userId, email: data?.user?.email })) return null;
  return errorResult(
    `Niche Finder is included on the Pro and Scale plans, not Core. The user can upgrade at ${APP_LINKS.pricing}.`,
    "plan_required",
    { actionUrl: APP_LINKS.pricing, plan: "Pro" }
  );
}

function matchNiche(raw: string): string | null {
  const wanted = raw.trim().toLowerCase();
  if (!wanted || wanted === "all") return "all";
  return NICHE_ORDER.find((name) => name.toLowerCase() === wanted) ?? null;
}

const browseNicheVideosTool: McpToolDefinition = {
  name: "browse_niche_videos",
  title: "Browse trending niche videos",
  description:
    "Browses Verlab's tracked trending TikTok/YouTube videos for a SPECIFIC niche the user already named, or 'all' niches blended together (Niche Finder, Pro and Scale plans). " +
    `Niches: ${NICHE_ORDER.join(", ")}. ` +
    "Useful for researching what's working in a niche before writing a script. Do NOT use this for an open-ended " +
    "'find me a niche' / 'what niche should I start' request -- use find_niche for that; this tool knows nothing about the user.",
  inputSchema: {
    niche: z.string().describe("A niche name from the list above, or 'all'."),
    platform: z.enum(["tiktok", "youtube", "all"]).optional().describe("Defaults to all."),
    page: z.number().int().min(1).optional().describe("Defaults to 1."),
    limit: z.number().int().min(1).max(50).optional().describe("Defaults to 20."),
  },
  annotations: READ_ONLY,
  handler: async (userId, args) => {
    const blocked = await nicheFinderBlock(userId);
    if (blocked) return blocked;

    const niche = matchNiche(String(args.niche ?? "all"));
    if (!niche) {
      return errorResult(`Unknown niche "${String(args.niche)}". Pick one of: ${NICHE_ORDER.join(", ")}, or "all".`, "invalid_input");
    }

    const platform = args.platform === "tiktok" || args.platform === "youtube" ? args.platform : "all";
    const page = Math.max(1, Number(args.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
    const result = await getNicheVideosPage(niche, niche === "all", { ...NICHE_QUERY_DEFAULTS, page, limit, platform });

    const videos = result.videos.map((video) => ({
      id: video.id,
      title: video.title ?? "",
      views: video.views ?? "",
      coverUrl: signThumbUrl(video.coverUrl),
      videoUrl: video.videoUrl ?? "",
      author: video.author ?? "",
      avatarUrl: signThumbUrl(video.avatarUrl),
      niche: video.niche ?? niche,
      platform: video.platform === "youtube" ? "youtube" : "tiktok",
    }));

    const label = niche === "all" ? "all niches" : niche;
    const text = videos.length
      ? `Top trending videos in ${label}${platform === "all" ? "" : ` on ${platform}`} (page ${page}):\n` +
        videos
          .map((v, i) => `${(page - 1) * limit + i + 1}. "${v.title.slice(0, 100)}" · ${v.views} views · ${v.author ? `@${v.author} · ` : ""}${v.platform} · ${v.videoUrl}`)
          .join("\n") +
        (result.hasMore ? `\nMore available: call again with page ${page + 1}.` : "")
      : `No trending videos tracked for ${label} right now.`;

    return appResult(text, { videos, page: result.page, limit: result.limit, hasMore: result.hasMore, niche });
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

type PublicNicheEntry = Omit<NicheReportEntry, "trackedNiche"> & { sampleVideos: EnrichedSampleVideo[] };

// The research pass only returns text examples (title + views). When a niche
// maps onto one of Verlab's tracked categories, swap in real cached videos
// with real thumbnails from the same cache browse_niche_videos uses.
async function enrichNicheWithRealVideos(niche: NicheReportEntry): Promise<PublicNicheEntry> {
  const { trackedNiche, ...publicFields } = niche;
  const textOnly: EnrichedSampleVideo[] = niche.sampleVideos.map((video) => ({
    ...video,
    coverUrl: null,
    videoUrl: null,
    author: null,
    avatarUrl: null,
  }));

  if (trackedNiche === "none" || !isNicheName(trackedNiche)) return { ...publicFields, sampleVideos: textOnly };

  const page = await getNicheVideosPage(trackedNiche, false, {
    ...NICHE_QUERY_DEFAULTS,
    page: 1,
    limit: 4,
    platform: niche.platform === "both" ? "all" : niche.platform,
  }).catch(() => null);
  if (!page || page.videos.length === 0) return { ...publicFields, sampleVideos: textOnly };

  return {
    ...publicFields,
    sampleVideos: page.videos.slice(0, 4).map((video) => ({
      title: video.title,
      views: video.views,
      coverUrl: signThumbUrl(video.coverUrl),
      videoUrl: video.videoUrl,
      author: video.author,
      avatarUrl: signThumbUrl(video.avatarUrl),
    })),
  };
}

function nicheReportText(niches: PublicNicheEntry[], live: boolean): string {
  return (
    `Niche report ready (${niches.length} niches${live ? ", researched live" : ""}). The full report with example videos is in the card above.\n` +
    niches
      .map(
        (n, i) =>
          `${i + 1}. ${n.name} (${n.platform}, momentum ${n.momentumScore}/100 ${n.momentumTrend}) -- ${n.description}\n   Why for them: ${n.whyForYou}\n   Starter angle: ${n.angle}`
      )
      .join("\n")
  );
}

const findNicheTool: McpToolDefinition = {
  name: "find_niche",
  title: "Find a content niche",
  description:
    "THE tool for 'find me a niche', 'what niche should I start', 'help me pick a niche', or any open-ended request to find/pick/suggest a content niche -- " +
    "call this immediately for those, even a bare one-line request. Called with no arguments it opens an interactive form (free) asking what they could talk " +
    "about for hours, channels they watch, YouTube or TikTok, long-form vs Shorts, how they want videos made, their background and budget. The form calls " +
    "this tool again with the answers, which researches what's going viral right now and returns 5-7 niches with real example videos, a momentum score and " +
    "a personalized starter angle (charges credits). If the user already described themselves in chat, call it directly with the answers filled in. " +
    "Part of Niche Finder (Pro and Scale plans); Core accounts get an upgrade prompt.",
  inputSchema: {
    interests: z.string().optional().describe("What they could talk about for hours."),
    channelsTheyLike: z.string().optional().describe("Channels/creators they already watch, names or @handles."),
    platform: z.enum(NICHE_REPORT_PLATFORMS).optional().describe("YouTube, TikTok, or both. Defaults to both."),
    format: z.enum(NICHE_FINDER_FORMATS).optional().describe("Long-form or Shorts. Defaults to not-sure."),
    productionStyle: z.enum(NICHE_FINDER_STYLES).optional().describe("How they want the videos made. Defaults to no-preference."),
    background: z.string().optional().describe("Any job, background, or skill to pull from."),
    budget: z.number().optional().describe("Monthly production budget in USD."),
  },
  annotations: CREATES,
  handler: async (userId, args) => {
    // Checked before the free form too, so a Core user isn't asked seven
    // questions only to hit the plan wall on submit.
    const blocked = await nicheFinderBlock(userId);
    if (blocked) return blocked;

    const interests = String(args.interests ?? "").trim();
    const channelsTheyLike = String(args.channelsTheyLike ?? "").trim();
    const background = String(args.background ?? "").trim();

    // Nothing to research yet -- this call just opens the form, which calls
    // this same tool again with real answers once the user submits.
    if (!interests && !channelsTheyLike) {
      return appResult(
        "Showing the Niche Finder form. Wait for the user to fill it in -- the report appears in the same card once they submit.",
        { stage: "form" }
      );
    }

    const pick = <T extends readonly string[]>(options: T, value: unknown, fallback: T[number]): T[number] =>
      (options as readonly string[]).includes(String(value)) ? (value as T[number]) : fallback;
    const platform = pick(NICHE_REPORT_PLATFORMS, args.platform, "both");
    const budgetNum = Number(args.budget);
    const answers: NicheFinderAnswers = {
      interests,
      channelsTheyLike,
      platform,
      format: pick(NICHE_FINDER_FORMATS, args.format, "not-sure"),
      productionStyle: pick(NICHE_FINDER_STYLES, args.productionStyle, "no-preference"),
      background,
      budget: Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : null,
    };

    const cost = TOOL_CREDIT_COSTS.niches.findNiche;
    const lacking = await requireCredits(userId, cost);
    if (lacking) return lacking;

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("niche_reports")
      .insert({ user_id: userId, platform, answers, status: "processing" })
      .select("id")
      .single();
    if (insertError || !row) return errorResult("Couldn't start the niche report. Please try again.");

    const outcome = await runJob(
      async () => {
        const { niches: rawNiches, live } = await researchViralNiches(answers);
        const niches = await Promise.all(rawNiches.map(enrichNicheWithRealVideos));
        await admin.from("niche_reports").update({ status: "complete", niches, live }).eq("id", row.id);
        await chargeUser(userId, cost, "Niche Finder Research", "niches.find_niche").catch((error) =>
          console.error("[mcp/find_niche] charge failed:", error)
        );
        recordUsageEvent("mcp", userId, { action: "nicheReport.research", reportId: row.id, live });
        return { niches, live };
      },
      async (error) => {
        console.error("[mcp/find_niche]", error);
        await admin.from("niche_reports").update({ status: "failed", error_message: "Research failed. Nothing was charged." }).eq("id", row.id);
      }
    );

    if (outcome.state === "running") {
      return appResult(`Researching niches now (report ${row.id}). ${POLLING_NOTE}`, { stage: "processing", id: row.id, platform });
    }
    if (outcome.state === "failed") return errorResult("The niche research failed. Nothing was charged -- please try again.");
    return appResult(nicheReportText(outcome.value.niches, outcome.value.live), {
      stage: "result",
      id: row.id,
      platform,
      niches: outcome.value.niches,
      live: outcome.value.live,
    });
  },
};

const checkNicheReportStatusTool: McpToolDefinition = {
  name: "check_niche_report_status",
  title: "Check niche report status",
  description: "Checks an in-progress find_niche report by its id. The Niche Finder card polls this itself.",
  inputSchema: { id: z.string() },
  annotations: STATUS_CHECK,
  handler: async (userId, args) => {
    const id = String(args.id ?? "").trim();
    if (!UUID_PATTERN.test(id)) return errorResult("That isn't a valid report id.", "invalid_input");
    const { data } = await createAdminClient()
      .from("niche_reports")
      .select("id, status, platform, niches, live, error_message")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return errorResult("That niche report wasn't found.", "not_found");
    if (data.status === "failed") {
      return appResult(`The niche research failed: ${data.error_message ?? "unknown error"}`, {
        stage: "error",
        error_message: data.error_message ?? "Research failed",
      });
    }
    if (data.status === "processing") {
      return appResult(`Still researching. ${POLLING_NOTE}`, { stage: "processing", id: data.id, platform: data.platform });
    }
    const niches = (data.niches as PublicNicheEntry[] | null) ?? [];
    return appResult(nicheReportText(niches, Boolean(data.live)), {
      stage: "result",
      id: data.id,
      platform: data.platform,
      niches,
      live: Boolean(data.live),
    });
  },
};

const CREATOR_ANALYSIS_VIDEO_COUNT = 5;

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "Creator";
}

interface AnalyzedVideo {
  title: string;
  views: string;
  url: string;
}

function creatorAnalysisCompleteResult(params: {
  id: string;
  channelName: string;
  videos: AnalyzedVideo[];
  analysis: CreatorAnalysis;
  hasDoc: boolean;
  docFilename: string;
}): McpToolResult {
  const { id, channelName, videos, analysis, hasDoc, docFilename } = params;
  const docUrl = hasDoc ? signMediaUrl("creator-doc", id, 0, { download: true }) : null;
  const text = [
    `Creator analysis for ${channelName} is complete (${videos.length} top videos, real transcripts). The full breakdown is in the card above.`,
    `Summary: ${analysis.executiveSummary}`,
    `Hook formula: ${analysis.hookFormula}`,
    `Pacing & structure: ${analysis.pacingAndStructure}`,
    `Voice & tone: ${analysis.voiceAndTone}`,
    `Recurring patterns: ${analysis.recurringPatterns}`,
    `Action steps:\n${analysis.actionSteps.map((step) => `- ${step}`).join("\n")}`,
    `Videos analyzed:\n${videos.map((v) => `- "${v.title}" · ${v.views} views · ${v.url}`).join("\n")}`,
    docUrl ? `Branded Word report (${docFilename}): ${docUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return appResult(text, {
    id,
    status: "complete",
    channelName,
    videos,
    summary: analysis.executiveSummary,
    analysis,
    docUrl,
    docFilename,
  });
}

const analyzeCreatorTool: McpToolDefinition = {
  name: "analyze_creator",
  title: "Analyze a creator's content strategy",
  description:
    `Deep-dive on ONE TikTok or YouTube creator: scrapes their ${CREATOR_ANALYSIS_VIDEO_COUNT} most-viewed videos, extracts the real transcripts and breaks down ` +
    "their hooks, pacing, structure and delivery, grounded in the transcript text with real view counts. Use when the user wants to reverse-engineer, " +
    "copy, 'steal' or study what makes a specific creator work. Returns a branded Word report link too. For a full reusable script playbook for a " +
    "related niche, use bend_niche instead. Charges credits (refunded if it fails).",
  inputSchema: { url: z.string().describe("A TikTok or YouTube creator/channel profile URL.") },
  annotations: CREATES,
  handler: async (userId, args) => {
    const url = String(args.url ?? "").trim();
    if (!url) return errorResult("Send a TikTok or YouTube channel link.", "invalid_input");

    const platform = detectCreatorPlatform(url);
    if (!platform) return errorResult("Only TikTok and YouTube channel/profile links are supported.", "invalid_input");

    const cost = TOOL_CREDIT_COSTS.creatorAnalysis.analyze;
    const charged = await chargeUpfront(userId, cost, "Creator Analysis", "creatorAnalysis.analyze");
    if (charged) return charged;

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("creator_analyses")
      .insert({ user_id: userId, source_url: url, platform, status: "processing" })
      .select("id")
      .single();

    if (insertError || !row) {
      await refundUser(userId, cost, "Creator Analysis refund", "creatorAnalysis.analyze");
      return errorResult("Couldn't start the analysis. Your credits were refunded.");
    }

    const outcome = await runJob(
      async () => {
        const channel = await scrapeChannelVideosWithUrls(url, platform, "shorts", CREATOR_ANALYSIS_VIDEO_COUNT);
        const transcribed = await fetchTranscriptsBounded(channel.videos, 2);
        if (transcribed.length === 0) throw new Error("Could not extract a transcript from any of this creator's top videos.");

        const videos = channel.videos.map((video) => ({ title: video.title, views: video.views, url: video.url }));
        const analysis = await analyzeCreatorTranscripts(
          channel.channelName,
          transcribed.map(({ video, text }) => ({ title: video.title, views: video.views, text }))
        );
        const docFilename = `${sanitizeFilename(channel.channelName)}, Content Strategy Analysis.docx`;
        const docBuffer = await buildCreatorAnalysisDocx(channel.channelName, url, platform, videos, analysis);

        await admin
          .from("creator_analyses")
          .update({
            status: "complete",
            channel_name: channel.channelName,
            videos,
            summary: analysis.executiveSummary,
            analysis,
            doc_base64: docBuffer.toString("base64"),
            doc_filename: docFilename,
          })
          .eq("id", row.id);
        recordUsageEvent("mcp", userId, { action: "creatorAnalysis.analyze", analysisId: row.id });
        return { channelName: channel.channelName, videos, analysis, docFilename };
      },
      async (error) => {
        console.error("[mcp/analyze_creator]", error);
        await admin
          .from("creator_analyses")
          .update({ status: "failed", error_message: `${errorMessage(error, "Analysis failed.")} Your credits were refunded.` })
          .eq("id", row.id);
        await refundUser(userId, cost, "Creator Analysis refund", "creatorAnalysis.analyze");
      }
    );

    if (outcome.state === "running") {
      return appResult(`Analyzing the creator's top videos now (analysis ${row.id}). ${POLLING_NOTE}`, {
        id: row.id,
        status: "processing",
      });
    }
    if (outcome.state === "failed") {
      return errorResult(`${errorMessage(outcome.error, "The analysis failed.")} Your credits were refunded.`);
    }
    return creatorAnalysisCompleteResult({ id: row.id, hasDoc: true, ...outcome.value });
  },
};

const checkCreatorAnalysisStatusTool: McpToolDefinition = {
  name: "check_creator_analysis_status",
  title: "Check creator analysis status",
  description: "Checks an in-progress analyze_creator job by its id. The creator card polls this itself.",
  inputSchema: { id: z.string() },
  annotations: STATUS_CHECK,
  handler: async (userId, args) => {
    const id = String(args.id ?? "").trim();
    if (!UUID_PATTERN.test(id)) return errorResult("That isn't a valid analysis id.", "invalid_input");
    const { data } = await createAdminClient()
      .from("creator_analyses")
      .select("id, status, channel_name, videos, analysis, doc_filename, error_message")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return errorResult("That analysis wasn't found.", "not_found");
    if (data.status === "failed") return errorResult(data.error_message ?? "The analysis failed. Your credits were refunded.");
    if (data.status !== "complete" || !data.analysis) {
      return appResult(`Still analyzing. ${POLLING_NOTE}`, { id: data.id, status: "processing" });
    }

    return creatorAnalysisCompleteResult({
      id: data.id,
      channelName: data.channel_name ?? "Creator",
      videos: (data.videos as AnalyzedVideo[] | null) ?? [],
      analysis: data.analysis as CreatorAnalysis,
      hasDoc: Boolean(data.doc_filename),
      docFilename: data.doc_filename ?? "Creator Analysis.docx",
    });
  },
};

export const RESEARCH_TOOLS: McpToolDefinition[] = [
  browseNicheVideosTool,
  findNicheTool,
  checkNicheReportStatusTool,
  analyzeCreatorTool,
  checkCreatorAnalysisStatusTool,
];
