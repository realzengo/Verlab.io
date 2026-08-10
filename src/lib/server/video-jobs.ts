// Shared "finish a video job" logic, called from two places that must stay
// in lockstep: the Replicate webhook handler (src/app/api/webhooks/replicate/route.ts,
// the primary completion path) and the cron reconciliation sweep
// (src/app/api/cron/video-poll/route.ts, the backstop for missed/failed
// webhook deliveries). Factored out once rather than duplicated so those two
// callers can never drift on charging/storage/status logic.
//
// Migrated off fal.ai onto Replicate (see replicate-video.ts) -- this only
// advances rows with a replicate_prediction_id populated. Any row still
// "queued"/"processing" from before this migration (fal_request_id
// populated, replicate_prediction_id null) has no completion path left and
// will age out via the existing STALE_JOB_MS timeout in
// /api/generate-video's GET handler rather than being specially migrated.
import { createAdminClient } from "@/lib/supabase/admin";
import { getVideoJobResult, downloadVideoAsset } from "./replicate-video";
import { chargeUser } from "./credits";
import { recordUsageEvent } from "./usage";
import { slugifyModelName } from "@/lib/config/pricing";
import { describeGenerationFailure } from "./generation-error";

const STORAGE_BUCKET = "videos";

export interface VideoJobRow {
  id: string;
  user_id: string;
  mode: "create" | "edit" | "motion";
  model: string;
  replicate_model: string | null;
  replicate_prediction_id: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  credits_quoted: number;
  credits_charged: number | null;
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Advances one video_generations row by checking Replicate's current job
 * status and, if finished, uploading the result into Storage and charging
 * credits. Safe to call repeatedly / concurrently for the same row (both the
 * "already settled" short-circuit and the credit charge are idempotent) --
 * the webhook and cron sweep can and will race each other for the same job.
 */
export async function advanceVideoJob(row: VideoJobRow, admin: AdminClient = createAdminClient()): Promise<void> {
  if (row.status === "completed" || row.status === "failed") return;
  if (!row.replicate_prediction_id) return; // submit always sets this before the row is visible to either caller

  try {
    const result = await getVideoJobResult(row.replicate_prediction_id);

    if (result.status !== "succeeded") {
      const isTerminalFailure = result.status === "failed" || result.status === "canceled" || result.status === "aborted";
      if (isTerminalFailure) {
        await admin
          .from("video_generations")
          .update({ status: "failed", ...describeGenerationFailure("video-jobs", result.errorMessage) })
          .eq("id", row.id);
        return;
      }
      if (row.status === "queued") {
        await admin.from("video_generations").update({ status: "processing" }).eq("id", row.id);
      }
      return;
    }

    if (!result.videoUrl) throw new Error("Replicate reported success but returned no video output");
    const video = await downloadVideoAsset(result.videoUrl);

    const outputPath = `${row.user_id}/${row.id}/output.mp4`;
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(outputPath, video.bytes, { contentType: video.contentType, upsert: true });
    if (uploadError) throw new Error(`Video storage upload failed: ${uploadError.message}`);

    // Replicate doesn't hand back a separate thumbnail the way fal's
    // response shape sometimes did -- v1 has no server-side frame-extraction
    // fallback (no ffmpeg dependency added for this), so the UI falls back
    // to the <video> element's own first-frame render instead.
    const thumbnailPath: string | null = null;

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
    await admin
      .from("video_generations")
      .update({ status: "failed", ...describeGenerationFailure("video-jobs", error) })
      .eq("id", row.id);
  }
}
