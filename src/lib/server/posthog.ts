import { PostHog } from "posthog-node";

/**
 * One-shot server-side capture. Builds a client, sends, and shuts it down
 * immediately rather than holding a long-lived singleton -- correct (no
 * queued events lost when a serverless function freezes) at the cost of a
 * bit of overhead, which is fine at this call volume (same trade-off
 * recordUsageEvent already makes with createAdminClient()). Never throws.
 */
export async function capturePostHogEvent(input: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  const client = new PostHog(key, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com" });
  try {
    client.capture({ distinctId: input.distinctId, event: input.event, properties: input.properties });
  } catch (error) {
    console.error(`[posthog] Failed to capture "${input.event}":`, error);
  } finally {
    await client.shutdown();
  }
}
