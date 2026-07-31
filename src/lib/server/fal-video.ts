// fal.ai's queue API for video models -- distinct from fal-image.ts, which
// calls fal.run/{model} and waits synchronously (image generation finishes
// in seconds; video renders regularly run 30s-10+ minutes, far past what's
// safe to hold a serverless invocation open for). Every video job is
// submitted here, then finished asynchronously by either a fal webhook
// (src/app/api/webhooks/fal/route.ts) or the cron reconciliation sweep
// (src/app/api/cron/video-poll/route.ts) calling checkJobStatus/fetchJobResult.
//
// Queue API shape (https://queue.fal.run) as of this writing:
//   POST   /{falSlug}                          -> { request_id }
//   GET    /{falSlug}/requests/{request_id}/status -> { status: "IN_QUEUE"|"IN_PROGRESS"|"COMPLETED" }
//   GET    /{falSlug}/requests/{request_id}     -> the model's normal output shape
// Verify this against fal's current docs before the first real deploy --
// same "don't trust, verify live" discipline fal-image.ts's own comments use.

const FAL_QUEUE_BASE_URL = "https://queue.fal.run";

// fal's queue status/result endpoints are registered per *app* (owner/alias
// -- the first two path segments), not per full endpoint id. Anything after
// that (e.g. "v2.5-turbo/pro/text-to-video") is a subpath that only applies
// to the initial submit call -- fal's own JS client drops it for status()/
// result() too (see parseEndpointId + status()/result() in
// fal-ai/fal-js/libs/client/src/queue.ts). Submitting against the full
// falSlug is correct; checking status/result against it 404s/405s.
function queueAppId(falSlug: string): string {
  return falSlug.split("/").slice(0, 2).join("/");
}

export class FalVideoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FalVideoError";
  }
}

function requireApiKey(): string {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) throw new FalVideoError("Missing FAL_API_KEY");
  return apiKey;
}

export interface SubmitVideoJobResult {
  requestId: string;
}

/**
 * Submits a job to fal's queue and returns immediately with a request id --
 * does not wait for the render. `webhookUrl`, when provided, is passed as
 * fal's `fal_webhook` query param so fal calls back on completion instead of
 * requiring us to poll; the cron sweep is the backstop for missed/failed
 * webhook deliveries, not the primary completion path.
 */
export async function submitVideoJob(
  falSlug: string,
  input: Record<string, unknown>,
  webhookUrl?: string
): Promise<SubmitVideoJobResult> {
  const apiKey = requireApiKey();
  const endpoint = new URL(`${FAL_QUEUE_BASE_URL}/${falSlug}`);
  if (webhookUrl) {
    endpoint.searchParams.set("fal_webhook", webhookUrl);
  }

  // Bounded -- this call only submits the job (fast, fal enqueues and
  // returns immediately); it never waits for the render itself, so this
  // timeout is a safety net against a hung connection, not a render budget.
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new FalVideoError(`fal queue submit failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json();
  const requestId: string | undefined = data?.request_id;
  if (!requestId) {
    throw new FalVideoError("fal queue submit returned no request_id");
  }

  return { requestId };
}

export type FalQueueStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";

export async function checkVideoJobStatus(falSlug: string, requestId: string): Promise<FalQueueStatus> {
  const apiKey = requireApiKey();
  const response = await fetch(`${FAL_QUEUE_BASE_URL}/${queueAppId(falSlug)}/requests/${requestId}/status`, {
    headers: { Authorization: `Key ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new FalVideoError(`fal queue status check failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json();
  const status: FalQueueStatus | undefined = data?.status;
  if (!status) {
    throw new FalVideoError("fal queue status check returned an unrecognized response shape");
  }
  return status;
}

export interface VideoJobResult {
  videoUrl: string;
  durationSeconds: number | null;
  /** Not every model returns one -- v1 has no server-side frame-extraction fallback (see video-jobs.ts), so this is opportunistic. */
  thumbnailUrl: string | null;
}

/**
 * Fetches the finished job's output. Only call once checkVideoJobStatus
 * (or fal's webhook payload) has already reported COMPLETED -- fal 400s if
 * asked for a result before the job settles.
 *
 * Response shape varies slightly per model family (most put the video under
 * `video.url`, some under `video_url` or `videos[0].url`), so this checks
 * the common shapes rather than assuming one -- mirrors fal-image.ts's own
 * defensive `data?.images?.[0]?.url` unwrap.
 */
export async function fetchVideoJobResult(falSlug: string, requestId: string): Promise<VideoJobResult> {
  const apiKey = requireApiKey();
  const response = await fetch(`${FAL_QUEUE_BASE_URL}/${queueAppId(falSlug)}/requests/${requestId}`, {
    headers: { Authorization: `Key ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new FalVideoError(`fal queue result fetch failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json();
  const videoUrl: string | undefined =
    data?.video?.url ?? data?.video_url ?? data?.videos?.[0]?.url ?? data?.output?.video?.url;

  if (!videoUrl) {
    throw new FalVideoError("fal queue result returned an unrecognized response shape");
  }

  const durationSeconds: number | null = typeof data?.video?.duration === "number" ? data.video.duration : null;
  const thumbnailUrl: string | null =
    data?.video?.thumbnail_url ?? data?.thumbnail?.url ?? data?.first_frame?.url ?? null;

  return { videoUrl, durationSeconds, thumbnailUrl };
}

/**
 * Downloads a fal-hosted result (video or image) so it can be re-uploaded
 * into our own Supabase Storage bucket -- fal's CDN URLs aren't guaranteed
 * permanent, so nothing keeps a bare fal URL as the long-term source of
 * truth (see the "Video storage" decision in the plan).
 */
export async function downloadFalAsset(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new FalVideoError(`Failed to download fal asset (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "video/mp4";
  return { bytes, contentType };
}
