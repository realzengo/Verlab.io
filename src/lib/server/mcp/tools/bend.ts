import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { recordUsageEvent } from "@/lib/server/usage";
import { detectCreatorPlatform } from "@/lib/server/apify-client";
import { createJob, getJob, resolveStatus, startSopGeneration, type NicheBendJobRow } from "@/lib/server/niche-bend-job-store";
import type { NicheBendJobStatusResponse, NicheBendSopContent, NicheBendVideoType } from "@/lib/types";
import { APP_LINKS } from "../links";
import { signThumbUrl } from "../thumb-proxy";
import {
  appResult,
  capText,
  CREATES,
  errorResult,
  POLLING_NOTE,
  requireCredits,
  STATUS_CHECK,
  UUID_PATTERN,
  type McpToolDefinition,
} from "./shared";

// "Bend" in the app: analyze a competitor channel, propose three adjacent
// niches that reuse its proven format ("bends"), then write a full script
// SOP for the one the user picks. The pipeline itself lives in
// niche-bend-job-store.ts (shared with the web wizard); it runs in after()
// and writes progress to niche_bend_jobs, which the bend card polls.
// The store reads/writes with whatever client it's given -- here the service
// role, so every lookup re-checks ownership itself.

/** The SOP as plain text: what generate_script receives for a sopId, and what the model reads. */
export function sopToText(content: NicheBendSopContent): string {
  const overview = content.channelOverview;
  const sections = [
    `${content.title}${content.subtitle ? ` -- ${content.subtitle}` : ""}`,
    content.onelinePromise,
    `CHANNEL: ${overview.channel} · niche: ${overview.niche} · format: ${overview.format} · POV: ${overview.narrationPov} · length: ${overview.avgLength}`,
    overview.recurringThemes.length ? `Recurring themes: ${overview.recurringThemes.join("; ")}` : "",
    overview.yourChannelNote ? `For your channel: ${overview.yourChannelNote}` : "",
    "HOOK PLAYBOOK:\n" +
      content.hookPlaybook
        .map((hook) => `- ${hook.template} (why: ${hook.psychology}; when: ${hook.whenToUse}) e.g. ${hook.forYourChannelExamples.slice(0, 2).join(" / ")}`)
        .join("\n"),
    "SCRIPT STRUCTURE:\n" + content.scriptStructureBeats.map((beat) => `- [${beat.timing}] ${beat.beat}: ${beat.function}`).join("\n"),
    "STORYTELLING FRAMEWORKS:\n" +
      content.storytellingFrameworks.map((f) => `- ${f.name}: ${f.howItWorks} Steps: ${f.steps.join(" → ")}`).join("\n"),
    "RETENTION:\n" +
      [
        `Rehooks: ${content.retentionMechanics.rehookCatalog.map((r) => `"${r.phrase}"`).join(", ")}`,
        `Pattern interrupts: ${content.retentionMechanics.patternInterrupts.join("; ")}`,
        `Open loops: ${content.retentionMechanics.openLoopsRule}`,
        `Specificity: ${content.retentionMechanics.specificitySpikesRule}`,
      ].join("\n"),
    "OPENING & CLOSING:\n" +
      [
        `First 30 seconds: ${content.openingClosingPatterns.first30SecondsTemplate.join(" → ")}`,
        `Hard rules: ${content.openingClosingPatterns.hardRules.join("; ")}`,
        `Endings: ${content.openingClosingPatterns.howVideosEnd}`,
      ].join("\n"),
    "QUICK REFERENCE:\n" +
      [
        `Beat structure: ${content.quickReferenceCard.beatStructureOneLine}`,
        `Do: ${content.quickReferenceCard.dos.join("; ")}`,
        `Don't: ${content.quickReferenceCard.donts.join("; ")}`,
      ].join("\n"),
  ];
  return sections.filter(Boolean).join("\n\n");
}

/** Loads the SOP text for a bend job owned by this user, or null. */
export async function loadSopText(userId: string, jobId: string): Promise<string | null> {
  if (!UUID_PATTERN.test(jobId)) return null;
  const job = await getJob(createAdminClient(), jobId);
  if (!job || job.user_id !== userId || !job.sop) return null;
  return sopToText(job.sop.content);
}

async function getOwnedJob(userId: string, jobId: string): Promise<NicheBendJobRow | null> {
  if (!UUID_PATTERN.test(jobId)) return null;
  const job = await getJob(createAdminClient(), jobId);
  return job && job.user_id === userId ? job : null;
}

/** The status payload the bend card renders -- the SOP's mock download links and raw avatar URL dropped. */
function publicStatus(status: NicheBendJobStatusResponse) {
  const { sop, analysis, ...rest } = status;
  return {
    ...rest,
    analysis: analysis ? { ...analysis, avatarUrl: signThumbUrl(analysis.avatarUrl) } : undefined,
    sop: sop ? { id: sop.id, chosenBend: sop.chosenBend, content: sop.content } : undefined,
    appUrl: APP_LINKS.bend,
  };
}

function statusText(status: NicheBendJobStatusResponse): string {
  const channel = status.analysis?.channelName ?? "the channel";
  if (status.status === "failed") return `The bend analysis failed: ${status.error?.message ?? "unknown error"}`;
  if (status.status === "sop_ready" && status.sop) {
    return capText(
      `SOP ready for "${status.sop.chosenBend.nicheName}" (bent from ${channel}). It's shown in the card above. ` +
        `To write scripts with it, call generate_script with sopId "${status.jobId}".\n\n${sopToText(status.sop.content)}`,
      9000,
      "SOP shortened here; generate_script with the sopId gets the full version"
    );
  }
  if (status.status === "generating_sop") return `Writing the SOP now. ${POLLING_NOTE}`;
  if (status.status === "ready" && status.candidates) {
    const errorLine = status.error ? `Last SOP attempt failed: ${status.error.message}\n` : "";
    return (
      `${errorLine}${channel} analyzed (${status.analysis?.detectedNiche ?? "niche"}; format: ${status.analysis?.format ?? "n/a"}). Three niche bends that reuse its format:\n` +
      status.candidates
        .map((c) => `${c.id}. ${c.nicheName} (${c.angle} angle) -- e.g. ${c.exampleTitles.slice(0, 3).map((t) => `"${t}"`).join(", ")}`)
        .join("\n") +
      `\nThe user can pick one in the card, or call create_sop with jobId "${status.jobId}" and bend 1, 2 or 3.`
    );
  }
  return `${status.statusText} ${POLLING_NOTE}`;
}

const bendNicheTool: McpToolDefinition = {
  name: "bend_niche",
  title: "Bend a competitor's niche",
  description:
    "Analyzes a successful competitor channel (YouTube or TikTok) and proposes three 'niche bends': adjacent niches that reuse the channel's proven " +
    "format with a fresh topic, each with example titles. The user then picks one (in the card, or via create_sop) to get a full script SOP: hook " +
    "playbook, beat structure, storytelling frameworks, retention rules. Use when the user wants to copy a channel's success in their own niche, " +
    "build a content playbook, or 'bend' a niche. Takes 1-3 minutes; the card updates itself. Charges credits (refunded if it fails).",
  inputSchema: {
    url: z.string().describe("The competitor's YouTube channel or TikTok profile URL."),
    videoType: z.enum(["long-form", "shorts"]).optional().describe("Which of their videos to study. Defaults to shorts for TikTok, long-form for YouTube."),
  },
  annotations: CREATES,
  handler: async (userId, args) => {
    const url = String(args.url ?? "").trim();
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    const platform = parsed && /^https?:$/.test(parsed.protocol) ? detectCreatorPlatform(url) : null;
    if (!platform) return errorResult("Send a YouTube channel or TikTok profile link.", "invalid_input");

    const videoType: NicheBendVideoType =
      args.videoType === "shorts" || args.videoType === "long-form" ? args.videoType : platform === "tiktok" ? "shorts" : "long-form";

    // Worst-case pre-check, same as the web route: which branch runs (cache
    // hit or full scrape) isn't known until the pipeline does, and it charges
    // the real amount itself.
    const lacking = await requireCredits(userId, TOOL_CREDIT_COSTS.nicheBend.analyzeScrape);
    if (lacking) return lacking;

    let job: NicheBendJobRow;
    try {
      job = await createJob(createAdminClient(), userId, { sourceUrl: url, platform, videoType });
    } catch (error) {
      console.error("[mcp/bend_niche]", error);
      return errorResult("Couldn't start the analysis. Nothing was charged -- please try again.");
    }
    recordUsageEvent("bend", userId, { jobId: job.id, source: "mcp" });

    const status = resolveStatus(job);
    return appResult(`Analyzing the channel now (job ${job.id}). ${POLLING_NOTE}`, publicStatus(status));
  },
};

const checkBendStatusTool: McpToolDefinition = {
  name: "check_bend_status",
  title: "Check niche bend status",
  description: "Returns a bend_niche job: its progress, the three bends once ready, and the SOP once written. The bend card polls this itself.",
  inputSchema: { jobId: z.string() },
  annotations: STATUS_CHECK,
  handler: async (userId, args) => {
    const job = await getOwnedJob(userId, String(args.jobId ?? "").trim());
    if (!job) return errorResult("That bend job wasn't found.", "not_found");
    const status = resolveStatus(job);
    return appResult(statusText(status), publicStatus(status));
  },
};

const createSopTool: McpToolDefinition = {
  name: "create_sop",
  title: "Write a script SOP",
  description:
    "Writes the full script SOP for one of the three bends from a finished bend_niche job: hook playbook, beat-by-beat structure, storytelling " +
    "frameworks, retention mechanics and a quick-reference card. Usually triggered from the bend card's 'Build SOP' button. Charges credits.",
  inputSchema: {
    jobId: z.string().describe("The bend_niche job id."),
    bend: z.number().int().min(1).max(3).describe("Which bend to build: 1, 2 or 3."),
  },
  annotations: CREATES,
  handler: async (userId, args) => {
    const job = await getOwnedJob(userId, String(args.jobId ?? "").trim());
    if (!job) return errorResult("That bend job wasn't found.", "not_found");

    const bend = Number(args.bend);
    if (bend !== 1 && bend !== 2 && bend !== 3) return errorResult("bend must be 1, 2 or 3.", "invalid_input");

    const current = resolveStatus(job);
    if (job.sop) {
      if (job.sop.chosenBend.id !== bend) {
        return errorResult(
          `This analysis already has an SOP for "${job.sop.chosenBend.nicheName}". Run bend_niche again on the channel to build a different one.`,
          "invalid_input"
        );
      }
      return appResult(statusText(current), publicStatus(current));
    }
    if (current.status === "generating_sop") return appResult(`The SOP is already being written. ${POLLING_NOTE}`, publicStatus(current));
    if (current.status !== "ready") return errorResult("The channel analysis isn't finished yet -- wait for the three bends first.", "invalid_input");

    const lacking = await requireCredits(userId, TOOL_CREDIT_COSTS.nicheBend.sop);
    if (lacking) return lacking;

    try {
      const updated = await startSopGeneration(createAdminClient(), job, bend);
      const status = resolveStatus(updated);
      return appResult(`Writing the SOP for "${updated.chosen_bend?.nicheName ?? `bend ${bend}`}" now. ${POLLING_NOTE}`, publicStatus(status));
    } catch (error) {
      console.error("[mcp/create_sop]", error);
      return errorResult("Couldn't start writing the SOP. Nothing was charged -- please try again.");
    }
  },
};

export const BEND_TOOLS: McpToolDefinition[] = [bendNicheTool, checkBendStatusTool, createSopTool];
