// Shared "finish a video job" logic, called from two places that must stay
// in lockstep: the fal webhook handler (src/app/api/webhooks/fal/route.ts,
// the primary completion path) and the cron reconciliation sweep
// (src/app/api/cron/video-poll/route.ts, the backstop for missed/failed
// webhook deliveries). Factored out once rather than duplicated so those two
// callers can never drift on charging/storage/status logic.
import { createAdminClient } from "@/lib/supabase/admin";
import { checkVideoJobStatus, downloadFalAsset, fetchVideoJobResult } from "./fal-video";
import { chargeUser } from "./credits";
import { recordUsageEvent } from "./usage";
import { slugifyModelName } from "@/lib/config/pricing";

const STORAGE_BUCKET = "videos";

export interface VideoJobRow {
  id: string;
  user_id: string;
  mode: "create" | "edit" | "motion";
  model: string;
  fal_model_slug: string;
  fal_request_id: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  credits_quoted: number;
  credits_charged: number | null;
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Advances one video_generations row by checking fal's current job status
 * and, if finished, uploading the result into Storage and charging credits.
 * Safe to call repeatedly / concurrently for the same row (both the "already
 * settled" short-circuit and the credit charge are idempotent) -- the
 * webhook and cron sweep can and will race each other for the same job.
 */
export async function advanceVideoJob(row: VideoJobRow, admin: AdminClient = createAdminClient()): Promise<void> {
  if (row.status === "completed" || row.status === "failed") return;
  if (!row.fal_request_id) return; // submit always sets this before the row is visible to either caller

  try {
    const falStatus = await checkVideoJobStatus(row.fal_model_slug, row.fal_request_id);

    if (falStatus !== "COMPLETED") {
      if (row.status === "queued") {
        await admin.from("video_generations").update({ status: "processing" }).eq("id", row.id);
      }
      return;
    }

    const result = await fetchVideoJobResult(row.fal_model_slug, row.fal_request_id);
    const video = await downloadFalAsset(result.videoUrl);

    const outputPath = `${row.user_id}/${row.id}/output.mp4`;
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(outputPath, video.bytes, { contentType: video.contentType, upsert: true });
    if (uploadError) throw new Error(`Video storage upload failed: ${uploadError.message}`);

    let thumbnailPath: string | null = null;
    if (result.thumbnailUrl) {
      // Best-effort -- v1 has no server-side frame-extraction fallback when
      // a model doesn't hand back a thumbnail (no ffmpeg dependency added
      // for this), so a missing thumbnail just means the UI falls back to
      // the <video> element's own first-frame render. Never fails the job.
      try {
        const thumb = await downloadFalAsset(result.thumbnailUrl);
        thumbnailPath = `${row.user_id}/${row.id}/thumb.jpg`;
        await admin.storage
          .from(STORAGE_BUCKET)
          .upload(thumbnailPath, thumb.bytes, { contentType: thumb.contentType, upsert: true });
      } catch (thumbError) {
        console.error("[video-jobs] Thumbnail upload failed (non-fatal):", thumbError);
        thumbnailPath = null;
      }
    }

    // Atomically claim the charge for this row: only the caller whose
    // UPDATE actually matches a still-null credits_charged row goes on to
    // call chargeUser. If the webhook and cron sweep both reach this point
    // for the same job, exactly one of them wins the claim -- the loser's
    // UPDATE affects zero rows and it skips charging entirely, so the user
    // is never billed twice for one render.
    const { data: claimed } = await admin
      .from("video_generations")
      .update({ credits_charged: row.credits_quoted })
      .eq("id", row.id)
      .is("credits_charged", null)
      .select("id");

    if (claimed && claimed.length > 0) {
      try {
        await chargeUser(row.user_id, row.credits_quoted, "Video Generation", `video.${row.mode}.${slugifyModelName(row.model)}`);
      } catch (creditError) {
        // The video is already rendered and stored -- a ledger failure
        // here shouldn't undo that (mirrors generate-image/route.ts).
        console.error("[credits] Failed to deduct for video generation:", creditError);
      }
    }

    await admin
      .from("video_generations")
      .update({ status: "completed", output_video_path: outputPath, thumbnail_path: thumbnailPath })
      .eq("id", row.id);

    void recordUsageEvent("video", row.user_id, { generationId: row.id, mode: row.mode, model: row.model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video generation failed";
    await admin.from("video_generations").update({ status: "failed", error_message: message }).eq("id", row.id);
  }
}
