// Shared Replicate SDK plumbing -- used by replicate-tts.ts, replicate-image.ts,
// and replicate-video.ts so the auth/output-unwrapping logic isn't
// triplicated across all three.
import Replicate from "replicate";

export class ReplicateApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplicateApiError";
  }
}

export function getReplicateClient(): Replicate {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) throw new ReplicateApiError("Missing REPLICATE_API_TOKEN");
  return new Replicate({ auth: apiToken });
}

// Replicate throttles the whole account (not per-model) to a burst of 1
// request per ~10s once its balance drops under $5 (confirmed live: a real
// 429 body reading "Your rate limit for creating predictions is reduced to 6
// requests per minute with a burst of 1 requests while you have less than
// $5.0 in credit... retry_after: 9"). This is expected/routine for a
// low-balance account, not an error condition worth surfacing on the first
// hit -- retry with the delay Replicate itself reports before giving up.
//
// The trap this used to fall into: callers that fan out several segments
// concurrently (see generate-voiceover's SEGMENT_CONCURRENCY) each discover
// the throttle independently -- N simultaneous calls each get their own 429,
// each retry on their own clock, and collide again next round. Confirmed
// live: a 3-4 segment "Line by Line" script would exhaust its 3 retries
// entirely on repeated collisions and fail outright, while even a single
// "All at Once" call could get caught behind another in-flight job's
// collision and take 60s+ for what should be a ~6s prediction.
//
// This module-level gate fixes that: the first caller to hit a 429 records
// the reported cooldown here, so every other in-process caller (regardless
// of which model or which route triggered it) waits it out too instead of
// re-discovering the same throttle the hard way. Once the account is funded
// past $5 the throttle stops firing entirely and this never engages, so it
// doesn't cap a healthy account's real concurrency.
let nextAllowedRequestAt = 0;

async function waitForRateLimitGate(): Promise<void> {
  const waitMs = nextAllowedRequestAt - Date.now();
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

export async function withReplicateRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await waitForRateLimitGate();
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries) throw error;

      const response = (error as { response?: Response })?.response;
      if (response?.status === 429) {
        const retryAfterHeader = response.headers.get("retry-after");
        const delaySeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
        const delayMs = Number.isFinite(delaySeconds) ? delaySeconds * 1000 : 5000 * (attempt + 1);
        nextAllowedRequestAt = Date.now() + Math.max(1000, delayMs);
        continue;
      }

      // Not a rate limit -- e.g. a bare "fetch failed" from a transient
      // network hiccup, which is common enough across a multi-segment job
      // that it deserves a short retry rather than failing the whole
      // generation over one dropped connection.
      if (response) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
}

// Replicate's SDK returns output shapes that vary by model/SDK version: a
// plain URL string, a FileOutput-like object exposing `.url()`, or an array
// of either -- unwrap defensively rather than assume one shape, same
// posture fal-video.ts's fetchVideoJobResult took toward fal's own
// per-model response variance.
export async function resolveOutputUrl(output: unknown): Promise<string> {
  const candidate = Array.isArray(output) ? output[0] : output;

  if (typeof candidate === "string") return candidate;

  if (candidate && typeof candidate === "object" && "url" in candidate && typeof (candidate as { url: unknown }).url === "function") {
    const url = await (candidate as { url: () => Promise<URL> | URL }).url();
    return url.toString();
  }

  throw new ReplicateApiError("Replicate returned an unrecognized output shape");
}

export async function resolveAllOutputUrls(output: unknown): Promise<string[]> {
  const candidates = Array.isArray(output) ? output : [output];
  return Promise.all(candidates.map((candidate) => resolveOutputUrl(candidate)));
}

/** Downloads a Replicate-hosted result so it can be re-uploaded into our own Storage -- Replicate's URLs aren't guaranteed permanent. */
export async function downloadReplicateAsset(url: string, timeoutMs = 120_000): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new ReplicateApiError(`Failed to download Replicate asset (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  return { bytes, contentType };
}
