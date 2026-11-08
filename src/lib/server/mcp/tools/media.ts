import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundUser } from "@/lib/server/credits";
import { recordUsageEvent } from "@/lib/server/usage";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import {
  fetchTranscript,
  fetchDownloadLink,
  detectTranscriptPlatform,
  detectDownloadPlatform,
  humanizeVideoProviderError,
} from "@/lib/server/video-provider";
import { DOWNLOAD_FORMAT_OPTIONS, getDownloadFormatOption, type DownloadFormat } from "@/lib/types";
import { signThumbUrl } from "../thumb-proxy";
import {
  appResult,
  capText,
  chargeUpfront,
  CREATES,
  errorResult,
  POLLING_NOTE,
  runJob,
  STATUS_CHECK,
  UUID_PATTERN,
  type McpToolDefinition,
} from "./shared";

// Rows still "processing" past this were cut off mid-job and will never
// finish; the status check fails and refunds them once.
const STALE_PROCESSING_MS = 8 * 60 * 1000;
const TRANSCRIPT_TEXT_MAX = 40_000;

interface TranscriptLine {
  timestamp: string;
  text: string;
}

function transcriptText(id: string, title: string | null, lines: TranscriptLine[]): string {
  const body = lines.map((line) => `[${line.timestamp}] ${line.text}`).join("\n");
  return capText(
    `Transcript of "${title ?? "the video"}" (${lines.length} lines, id ${id} -- usable as transcriptIds in generate_script):\n\n${body}`,
    TRANSCRIPT_TEXT_MAX,
    "transcript truncated here; the full text is in the card above and in Verlab"
  );
}

/** Fails a row that's been "processing" too long, refunding it exactly once. */
async function failStaleRow(table: "transcripts" | "downloads", id: string, userId: string, refund: () => Promise<void>): Promise<string> {
  const message = "This took too long and was stopped. Your credits were refunded.";
  const { data: claimed } = await createAdminClient()
    .from(table)
    .update({ status: "failed", error_message: message })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "processing")
    .select("id");
  if (claimed?.length) await refund();
  return message;
}

const extractTranscriptTool: McpToolDefinition = {
  name: "extract_transcript",
  title: "Extract a video transcript",
  description:
    "Extracts the full timestamped transcript from a TikTok, Instagram Reel or YouTube video (Shorts or long-form). The transcript text comes back to you, " +
    "and the id can be passed to generate_script as a style example. Charges credits (refunded if it fails).",
  inputSchema: { url: z.string().describe("A TikTok, Instagram Reels or YouTube URL.") },
  annotations: CREATES,
  handler: async (userId, args) => {
    const url = String(args.url ?? "").trim();
    if (!url) return errorResult("Send a TikTok, Instagram Reel or YouTube link.", "invalid_input");
    const platform = detectTranscriptPlatform(url);
    if (!platform) return errorResult("Only TikTok, Instagram Reels and YouTube links are supported.", "invalid_input");

    const cost = TOOL_CREDIT_COSTS.transcripts.extract;
    const refund = () => refundUser(userId, cost, "Transcript Extraction refund", "transcripts.extract");
    const charged = await chargeUpfront(userId, cost, "Transcript Extraction", "transcripts.extract");
    if (charged) return charged;

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("transcripts")
      .insert({ user_id: userId, source_url: url, platform, status: "processing" })
      .select("id")
      .single();
    if (insertError || !row) {
      await refund();
      return errorResult("Couldn't start the extraction. Your credits were refunded.");
    }

    let failureMessage = "Couldn't extract that transcript.";
    const outcome = await runJob(
      async () => {
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
      },
      async (error) => {
        failureMessage = `${humanizeVideoProviderError(error)} Your credits were refunded.`;
        const { data: claimed } = await admin
          .from("transcripts")
          .update({ status: "failed", error_message: failureMessage })
          .eq("id", row.id)
          .eq("status", "processing")
          .select("id");
        if (claimed?.length) await refund();
      }
    );

    if (outcome.state === "running") {
      return appResult(`Extracting the transcript now (id ${row.id}). ${POLLING_NOTE}`, { id: row.id, status: "processing" });
    }
    if (outcome.state === "failed") return errorResult(failureMessage);
    const { value } = outcome;
    return appResult(transcriptText(row.id, value.title, value.lines), {
      id: row.id,
      status: "complete",
      title: value.title,
      coverUrl: signThumbUrl(value.coverUrl),
      videoUrl: value.videoUrl,
      embedUrl: value.embedUrl,
      lines: value.lines,
    });
  },
};

const checkTranscriptStatusTool: McpToolDefinition = {
  name: "check_transcript_status",
  title: "Check transcript status",
  description: "Returns a transcript by its id (from extract_transcript), once it's ready. The transcript card polls this itself.",
  inputSchema: { id: z.string() },
  annotations: STATUS_CHECK,
  handler: async (userId, args) => {
    const id = String(args.id ?? "").trim();
    if (!UUID_PATTERN.test(id)) return errorResult("That isn't a valid transcript id.", "invalid_input");
    const { data } = await createAdminClient()
      .from("transcripts")
      .select("id, status, title, cover_url, video_url, embed_url, lines, error_message, created_at")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return errorResult("That transcript wasn't found.", "not_found");

    if (data.status === "failed") return errorResult(data.error_message ?? "The extraction failed. Your credits were refunded.");
    if (data.status !== "complete") {
      if (Date.now() - new Date(data.created_at).getTime() > STALE_PROCESSING_MS) {
        const cost = TOOL_CREDIT_COSTS.transcripts.extract;
        return errorResult(await failStaleRow("transcripts", id, userId, () => refundUser(userId, cost, "Transcript Extraction refund", "transcripts.extract")));
      }
      return appResult(`Still extracting. ${POLLING_NOTE}`, { id, status: "processing" });
    }

    const lines = (data.lines as TranscriptLine[] | null) ?? [];
    return appResult(transcriptText(id, data.title, lines), {
      id,
      status: "complete",
      title: data.title,
      coverUrl: signThumbUrl(data.cover_url),
      videoUrl: data.video_url,
      embedUrl: data.embed_url,
      lines,
    });
  },
};

const DOWNLOAD_FORMATS = DOWNLOAD_FORMAT_OPTIONS.map((option) => option.value) as [DownloadFormat, ...DownloadFormat[]];

const downloadVideoTool: McpToolDefinition = {
  name: "download_video",
  title: "Download a video",
  description:
    "Downloads a TikTok, YouTube or Facebook video without a watermark (or extracts its audio) and returns a direct file link. Charges credits (refunded if it fails). Formats: " +
    DOWNLOAD_FORMAT_OPTIONS.map((option) => `${option.value} (${option.label})`).join(", "),
  inputSchema: {
    url: z.string().describe("A TikTok, YouTube or Facebook URL."),
    format: z.enum(DOWNLOAD_FORMATS).optional().describe("Defaults to 720 (MP4 720p)."),
  },
  annotations: CREATES,
  handler: async (userId, args) => {
    const url = String(args.url ?? "").trim();
    if (!url) return errorResult("Send a TikTok, YouTube or Facebook link.", "invalid_input");
    const formatOption = getDownloadFormatOption(String(args.format ?? "720"));
    if (!formatOption) return errorResult(`Unsupported format. Use one of: ${DOWNLOAD_FORMATS.join(", ")}.`, "invalid_input");
    const format: DownloadFormat = formatOption.value;
    const platform = detectDownloadPlatform(url);
    if (!platform) return errorResult("Only TikTok, YouTube and Facebook links are supported.", "invalid_input");

    const cost = TOOL_CREDIT_COSTS.downloads.create;
    const refund = () => refundUser(userId, cost, "Video Download refund", "downloads.create");
    const charged = await chargeUpfront(userId, cost, "Video Download", "downloads.create");
    if (charged) return charged;

    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("downloads")
      .insert({ user_id: userId, source_url: url, platform, format, status: "processing" })
      .select("id")
      .single();
    if (insertError || !row) {
      await refund();
      return errorResult("Couldn't start the download. Your credits were refunded.");
    }

    let failureMessage = "Couldn't download that video.";
    const outcome = await runJob(
      async () => {
        const result = await fetchDownloadLink(url, format, (percent) => {
          void admin.from("downloads").update({ progress: percent }).eq("id", row.id);
        });
        await admin
          .from("downloads")
          .update({ status: "complete", progress: 100, title: result.title, file_path: result.directUrl })
          .eq("id", row.id);
        recordUsageEvent("downloader", userId, { downloadId: row.id, source: "mcp" });
        return result;
      },
      async (error) => {
        failureMessage = `${humanizeVideoProviderError(error)} Your credits were refunded.`;
        const { data: claimed } = await admin
          .from("downloads")
          .update({ status: "failed", error_message: failureMessage })
          .eq("id", row.id)
          .eq("status", "processing")
          .select("id");
        if (claimed?.length) await refund();
      }
    );

    if (outcome.state === "running") {
      return appResult(`Downloading now (id ${row.id}). ${POLLING_NOTE}`, { id: row.id, status: "processing", progress: 0, format: formatOption.label });
    }
    if (outcome.state === "failed") return errorResult(failureMessage);
    return appResult(`"${outcome.value.title}" is ready to download (${formatOption.label}): ${outcome.value.directUrl}`, {
      id: row.id,
      status: "complete",
      progress: 100,
      title: outcome.value.title,
      url: outcome.value.directUrl,
      format: formatOption.label,
    });
  },
};

const checkDownloadStatusTool: McpToolDefinition = {
  name: "check_download_status",
  title: "Check download status",
  description: "Checks a download_video job by its id. The download card polls this itself.",
  inputSchema: { id: z.string() },
  annotations: STATUS_CHECK,
  handler: async (userId, args) => {
    const id = String(args.id ?? "").trim();
    if (!UUID_PATTERN.test(id)) return errorResult("That isn't a valid download id.", "invalid_input");
    const { data } = await createAdminClient()
      .from("downloads")
      .select("id, status, progress, title, file_path, format, error_message, created_at")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return errorResult("That download wasn't found.", "not_found");

    const format = getDownloadFormatOption(String(data.format ?? ""))?.label ?? null;
    if (data.status === "failed") return errorResult(data.error_message ?? "The download failed. Your credits were refunded.");
    if (data.status !== "complete" || !data.file_path) {
      if (Date.now() - new Date(data.created_at).getTime() > STALE_PROCESSING_MS) {
        const cost = TOOL_CREDIT_COSTS.downloads.create;
        return errorResult(await failStaleRow("downloads", id, userId, () => refundUser(userId, cost, "Video Download refund", "downloads.create")));
      }
      return appResult(`Still downloading${typeof data.progress === "number" ? ` (${data.progress}%)` : ""}. ${POLLING_NOTE}`, {
        id,
        status: "processing",
        progress: data.progress,
        format,
      });
    }
    return appResult(`"${data.title ?? "Video"}" is ready to download: ${data.file_path}`, {
      id,
      status: "complete",
      progress: 100,
      title: data.title,
      url: data.file_path,
      format,
    });
  },
};

export const MEDIA_TOOLS: McpToolDefinition[] = [extractTranscriptTool, checkTranscriptStatusTool, downloadVideoTool, checkDownloadStatusTool];
