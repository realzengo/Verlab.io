import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClippingCost } from "@/lib/config/pricing";
import { refundUser } from "@/lib/server/credits";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getClipSourceVideo } from "@/lib/server/clips/youtube";
import { YoutubeError } from "@/lib/server/youtube-client";
import { CLIP_PROJECT_COLUMNS, advanceClipProject, prepareClipProject, type ClipProjectRow } from "@/lib/server/clips/projects";
import { clipSourceProblem } from "@/lib/server/clips/source-rules";
import {
  CLIP_LENGTHS,
  isClipProjectWorking,
  normalizeClipOptions,
  parseYoutubeVideoId,
  youtubeWatchUrl,
  type ClipMoment,
} from "@/lib/clips";
import { APP_LINKS } from "../links";
import { signThumbUrl } from "../thumb-proxy";
import {
  appResult,
  chargeUpfront,
  CREATES,
  errorResult,
  formatSeconds,
  POLLING_NOTE,
  STATUS_CHECK,
  UUID_PATTERN,
  type McpToolDefinition,
} from "./shared";

// Clipping in Claude: the same project pipeline as /clipping (fetch audio ->
// WhisperX -> moment-finding LLM, with refunds on failure inside
// projects.ts). Only the first hop runs in the background (after()); every
// later hop happens when a status check advances the project, exactly like
// the web page's poll. Rendering the 9:16 clips (reframe, captions, export)
// is client-side in the web editor, so the card hands off to it.

// Moment-finding runs inline in the advancing call (~70s for an hour of
// transcript). Cap how long one status check waits on it; the rest keeps
// running in after() and the next check picks up the result.
const ADVANCE_BUDGET_MS = 40_000;

const STAGES: Record<string, string> = {
  queued: "Fetching the video's audio",
  transcribing: "Transcribing every word",
  finding: "Finding the viral moments",
  ready: "Clips ready",
  failed: "Failed",
};

function clipPayload(row: ClipProjectRow) {
  const clips = [...(row.clips ?? [])]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((clip: ClipMoment) => ({
      id: clip.id,
      start: clip.start,
      end: clip.end,
      durationSeconds: Math.max(0, Math.round(clip.end - clip.start)),
      title: clip.title,
      hookTitle: clip.hookTitle,
      hook: clip.hook,
      score: clip.score,
      scores: clip.scores,
      reason: clip.reason,
      caption: clip.caption,
      hashtags: clip.hashtags ?? [],
      watchUrl: `${youtubeWatchUrl(row.video_id)}&t=${Math.floor(clip.start)}s`,
    }));
  return {
    id: row.id,
    status: row.status,
    stage: STAGES[row.status] ?? row.status,
    title: row.title,
    channel: row.channel_title,
    thumbnailUrl: signThumbUrl(row.thumbnail_url),
    durationSeconds: row.duration_seconds,
    sourceUrl: row.source_url,
    creditsCharged: row.credits_charged,
    clips,
    editorUrl: APP_LINKS.clipProject(row.id),
    error_message: row.error_message,
  };
}

function clipsText(payload: ReturnType<typeof clipPayload>): string {
  if (payload.status === "ready") {
    return (
      `Found ${payload.clips.length} clips in "${payload.title}". They're in the card above, best first. ` +
      `To export them as captioned 9:16 videos (AI reframe, caption styles, hooks), open the editor: ${payload.editorUrl}\n\n` +
      payload.clips
        .map(
          (clip, i) =>
            `${i + 1}. [${formatSeconds(clip.start)}-${formatSeconds(clip.end)}, ${clip.durationSeconds}s, score ${clip.score}] ${clip.title}\n` +
            `   Hook: "${clip.hookTitle}" · Why: ${clip.reason}\n   Caption: ${clip.caption} ${clip.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ")}`
        )
        .join("\n")
    );
  }
  return `${payload.stage} for "${payload.title}" (${formatSeconds(payload.durationSeconds)} long, about 1-3 minutes total). ${POLLING_NOTE}`;
}

const createClipsTool: McpToolDefinition = {
  name: "create_clips",
  title: "Clip a YouTube video",
  description:
    "Turns a long YouTube video (podcast, stream, interview; 2 minutes to 3 hours) into viral short-form clip candidates: transcribes every word, finds the " +
    "strongest self-contained moments and scores each one on hook, flow, value and trend, with a hook title, ready-to-post caption and hashtags. Takes 1-3 " +
    "minutes; the card updates itself and links to the Verlab editor for captioned 9:16 export. Cost scales with length (about 37 credits for 10 minutes, " +
    "106 for an hour), refunded automatically if it fails.",
  inputSchema: {
    url: z.string().describe("A YouTube video link."),
    length: z.enum(CLIP_LENGTHS.map((option) => option.value) as [string, ...string[]]).optional().describe("Clip length: auto (default), short (<30s), medium (30-60s), long (60-90s)."),
    focus: z.string().max(200).optional().describe("Optional: what to look for, e.g. 'the funniest moments' or 'anything about money'."),
  },
  annotations: CREATES,
  handler: async (userId, args) => {
    const videoId = parseYoutubeVideoId(String(args.url ?? ""));
    if (!videoId) return errorResult("Send a YouTube video link (youtube.com/watch, youtu.be or a Shorts/live link).", "invalid_input");

    if (!(await checkRateLimit(`clips-create:${userId}`, 5, 60))) {
      return errorResult("Too many clip projects started in the last minute. Wait a moment and try again.");
    }

    let video;
    try {
      video = await getClipSourceVideo(videoId);
    } catch (error) {
      if (error instanceof YoutubeError && error.code === "quota_exceeded") {
        return errorResult("YouTube is busy right now. Try again in a little while.");
      }
      console.error("[mcp/create_clips] lookup failed:", error);
      return errorResult("Couldn't look up that video. Please try again.");
    }
    if (!video) return errorResult("That video couldn't be found. It may be private or deleted.", "not_found");

    const problem = clipSourceProblem(video.durationSeconds);
    if (problem) return errorResult(problem, "invalid_input");

    const cost = getClippingCost(video.durationSeconds);
    const charged = await chargeUpfront(userId, cost, "Clipping", "clipping.analyze");
    if (charged) return charged;

    const { data, error } = await createAdminClient()
      .from("clip_projects")
      .insert({
        user_id: userId,
        source_url: youtubeWatchUrl(videoId),
        video_id: videoId,
        title: video.title,
        channel_title: video.channelTitle || null,
        thumbnail_url: video.thumbnailUrl || null,
        duration_seconds: video.durationSeconds,
        options: normalizeClipOptions({ length: args.length, focus: args.focus }),
        credits_charged: cost,
      })
      .select(CLIP_PROJECT_COLUMNS)
      .single<ClipProjectRow>();

    if (error || !data) {
      await refundUser(userId, cost, "Clipping refund", "clipping.analyze");
      return errorResult("Couldn't start clipping. Your credits were refunded.");
    }

    after(() => prepareClipProject(data.id));

    const payload = clipPayload(data);
    return appResult(`Clipping "${video.title}" (${cost} credits). ${clipsText(payload)}`, payload);
  },
};

const checkClipsStatusTool: McpToolDefinition = {
  name: "check_clips_status",
  title: "Check clip project status",
  description: "Returns a clip project's progress, and its scored clips once ready. Also opens any older project by id. The clips card polls this itself.",
  inputSchema: { id: z.string().describe("The clip project id.") },
  annotations: STATUS_CHECK,
  handler: async (userId, args) => {
    const id = String(args.id ?? "").trim();
    if (!UUID_PATTERN.test(id)) return errorResult("That isn't a valid clip project id.", "invalid_input");

    const { data: row } = await createAdminClient()
      .from("clip_projects")
      .select(CLIP_PROJECT_COLUMNS)
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle<ClipProjectRow>();
    if (!row) return errorResult("That clip project wasn't found on this account.", "not_found");

    let current = row;
    if (isClipProjectWorking(row.status)) {
      const advancing = advanceClipProject(row).catch((error) => {
        // A provider blip just means "still working"; the next check retries.
        console.error("[mcp/check_clips_status] advance failed:", error);
        return row;
      });
      after(() => advancing.then(() => undefined));
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waited = await Promise.race([
        advancing,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), ADVANCE_BUDGET_MS);
        }),
      ]);
      clearTimeout(timer);
      current = waited ?? row;
    }

    if (current.status === "failed") {
      return errorResult(current.error_message ?? "Clipping failed. Your credits were refunded.");
    }
    const payload = clipPayload(current);
    return appResult(clipsText(payload), payload);
  },
};

export const CLIP_TOOLS: McpToolDefinition[] = [createClipsTool, checkClipsStatusTool];
