// Replaces fal-video.ts. Replicate's prediction API is the direct analog to
// fal's queue: submit returns immediately with an id, a webhook fires on
// completion, and a cron sweep is the backstop for missed deliveries --
// same shape as fal-video.ts, just a different provider's async job API
// underneath (video renders regularly run 30s-10+ minutes, far past what's
// safe to hold a serverless invocation open for, same rationale as before).
//
// Unlike fal's queue (separate status/result endpoints keyed by an
// "app id"), Replicate's predictions.get(id) returns status AND output in
// one call once finished -- no separate result fetch needed.
import { getReplicateClient, resolveOutputUrl, downloadReplicateAsset, withReplicateRetry, ReplicateApiError } from "./replicate-client";

export { ReplicateApiError as ReplicateVideoError };

export interface SubmitVideoJobResult {
  predictionId: string;
}

/**
 * Submits a job to Replicate and returns immediately with a prediction id --
 * does not wait for the render. `webhookUrl`, when provided, is registered
 * so Replicate calls back on completion instead of requiring us to poll;
 * the cron sweep is the backstop for missed/failed webhook deliveries, not
 * the primary completion path.
 */
export async function submitVideoJob(replicateModel: string, input: Record<string, unknown>, webhookUrl?: string): Promise<SubmitVideoJobResult> {
  const replicate = getReplicateClient();

  try {
    // Wrapped in withReplicateRetry -- low-balance accounts get throttled to
    // a burst of 1 request/~6s, easy to hit here since Create's multi-output
    // requests submit one prediction per output in a tight loop (see
    // generate-video/route.ts).
    const prediction = await withReplicateRetry(() =>
      replicate.predictions.create({
        model: replicateModel,
        input,
        ...(webhookUrl ? { webhook: webhookUrl, webhook_events_filter: ["completed"] as const } : {}),
      })
    );
    return { predictionId: prediction.id };
  } catch (error) {
    throw new ReplicateApiError(error instanceof Error ? error.message : "Replicate prediction submit failed");
  }
}

export type ReplicateJobStatus = "starting" | "processing" | "succeeded" | "failed" | "canceled" | "aborted";

export interface VideoJobResult {
  status: ReplicateJobStatus;
  videoUrl: string | null;
  errorMessage: string | null;
}

/**
 * Fetches a prediction's current status AND output (if finished) in one
 * call -- unlike fal-video.ts's separate checkVideoJobStatus/
 * fetchVideoJobResult, Replicate's API doesn't need two round trips.
 */
export async function getVideoJobResult(predictionId: string): Promise<VideoJobResult> {
  const replicate = getReplicateClient();

  let prediction: Awaited<ReturnType<typeof replicate.predictions.get>>;
  try {
    // Wrapped in withReplicateRetry -- the cron sweep checks every in-flight
    // row in one Promise.all burst (see /api/cron/video-poll), which can
    // itself trip the same low-balance throttle.
    prediction = await withReplicateRetry(() => replicate.predictions.get(predictionId));
  } catch (error) {
    throw new ReplicateApiError(error instanceof Error ? error.message : "Replicate prediction status check failed");
  }

  if (prediction.status !== "succeeded") {
    const isTerminalFailure = prediction.status === "failed" || prediction.status === "canceled" || prediction.status === "aborted";
    return {
      status: prediction.status,
      videoUrl: null,
      errorMessage: isTerminalFailure ? String(prediction.error ?? "Generation failed") : null,
    };
  }

  const videoUrl = await resolveOutputUrl(prediction.output);
  return { status: "succeeded", videoUrl, errorMessage: null };
}

export { downloadReplicateAsset as downloadVideoAsset };
