import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordUsageEvent } from "@/lib/server/usage";
import { fetchTranscript, detectTranscriptPlatform, humanizeVideoProviderError } from "@/lib/server/video-provider";
import { signThumbUrl } from "../thumb-proxy";
import {
  appResult,
  capText,
  CREATES,
  errorResult,
  POLLING_NOTE,
  runJob,
  STATUS_CHECK,
  UUID_PATTERN,
  type McpToolDefinition,
} from "./shared";

// Rows still "processing" past this were cut off mid-job and will never
// finish; the status check marks them failed.
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

/** Fails a transcript that's been "processing" too long. Transcripts use no credits, so there's nothing to refund. */
async function failStaleTranscript(id: string, userId: string): Promise<string> {
  const message = "This took too long and was stopped. Please try again.";
  const { data: claimed } = await createAdminClient()
    .from("transcripts")
    .update({ status: "failed", error_message: message })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "processing")
    .select("id");
  if (!claimed?.length) console.warn(`[mcp:transcripts] stale transcript ${id} was already settled`);
  return message;
}

const extractTranscriptTool: McpToolDefinition = {
  name: "extract_transcript",
  title: "Extract a video transcript",
  description:
    "Extracts the full timestamped transcript from a TikTok, Instagram Reel or YouTube video (Shorts or long-form). The transcript text comes back to you, " +
    "and the id can be passed to generate_script as a style example. Included in every plan: uses no credits.",
  inputSchema: { url: z.string().describe("A TikTok, Instagram Reels or YouTube URL.") },
  annotations: CREATES,
  handler: async (userId, args) => {
    const url = String(args.url ?? "").trim();
    if (!url) return errorResult("Send a TikTok, Instagram Reel or YouTube link.", "invalid_input");
    const platform = detectTranscriptPlatform(url);
    if (!platform) return errorResult("Only TikTok, Instagram Reels and YouTube links are supported.", "invalid_input");

    // Transcripts are included in every plan and use no credits, the same
    // as in the app (POST /api/transcripts/extract) -- the plan check itself
    // happens for every tool in mcp/server.ts.
    const admin = createAdminClient();
    const { data: row, error: insertError } = await admin
      .from("transcripts")
      .insert({ user_id: userId, source_url: url, platform, status: "processing" })
      .select("id")
      .single();
    if (insertError || !row) {
      return errorResult("Couldn't start the extraction. Please try again.");
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
        failureMessage = humanizeVideoProviderError(error);
        await admin
          .from("transcripts")
          .update({ status: "failed", error_message: failureMessage })
          .eq("id", row.id)
          .eq("status", "processing");
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
      // The card's Watch button opens this: the original post, never a file.
      videoUrl: url,
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
      .select("id, status, title, cover_url, source_url, embed_url, lines, error_message, created_at")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return errorResult("That transcript wasn't found.", "not_found");

    if (data.status === "failed") return errorResult(data.error_message ?? "The extraction failed. Please try again.");
    if (data.status !== "complete") {
      if (Date.now() - new Date(data.created_at).getTime() > STALE_PROCESSING_MS) {
        return errorResult(await failStaleTranscript(id, userId));
      }
      return appResult(`Still extracting. ${POLLING_NOTE}`, { id, status: "processing" });
    }

    const lines = (data.lines as TranscriptLine[] | null) ?? [];
    return appResult(transcriptText(id, data.title, lines), {
      id,
      status: "complete",
      title: data.title,
      coverUrl: signThumbUrl(data.cover_url),
      videoUrl: data.source_url,
      embedUrl: data.embed_url,
      lines,
    });
  },
};

// download_video / check_download_status were removed with the video
// downloader (2026-11-26).
export const MEDIA_TOOLS: McpToolDefinition[] = [extractTranscriptTool, checkTranscriptStatusTool];
