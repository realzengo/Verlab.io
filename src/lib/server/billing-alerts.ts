import "server-only";
import { PostHog } from "posthog-node";

export type BillingAlertSource = "whop_webhook" | "whop_sync_cron" | "payment_failed_email";

export interface BillingAlert {
  source: BillingAlertSource;
  /** What was being attempted, e.g. "process_event", "log_event", "reconcile". */
  stage: string;
  error: unknown;
  /** Whop's webhook delivery id (msg_...), when there is one. */
  eventId?: string | null;
  eventType?: string | null;
  /** The Whop object the failure concerns (pay_..., mem_..., ...). */
  objectId?: string | null;
  /** Our user id, when known, so the error links to that person in PostHog. */
  userId?: string | null;
  extra?: Record<string, unknown>;
}

/**
 * Billing failures that are caught and swallowed (the webhook always answers
 * Whop 200; the sync cron keeps going past one bad object) never reach
 * instrumentation.ts's onRequestError, so they'd only exist in Vercel logs.
 * This logs them and sends each one to PostHog -> Error tracking as an
 * exception tagged `billing_alert`, carrying the event id, type and message,
 * so a PostHog alert on that tag notices them.
 *
 * Production only, like onRequestError: local runs point at the production
 * database and shouldn't page anyone. Never throws.
 */
export async function reportBillingError(alert: BillingAlert): Promise<void> {
  const error = alert.error instanceof Error ? alert.error : new Error(describe(alert.error));
  console.error(`[billing:${alert.source}] ${alert.stage} failed`, {
    eventId: alert.eventId ?? null,
    eventType: alert.eventType ?? null,
    objectId: alert.objectId ?? null,
    userId: alert.userId ?? null,
    message: error.message,
    ...alert.extra,
  });

  if (process.env.NODE_ENV !== "production") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  try {
    const client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
    await client.captureExceptionImmediate(error, alert.userId ?? "billing-system", {
      billing_alert: true,
      billing_source: alert.source,
      billing_stage: alert.stage,
      whop_event_id: alert.eventId ?? null,
      whop_event_type: alert.eventType ?? null,
      whop_object_id: alert.objectId ?? null,
      error_message: error.message,
      ...alert.extra,
    });
    await client.shutdown();
  } catch (captureError) {
    console.error("[billing] couldn't report to PostHog:", captureError);
  }
}

/** Supabase/PostgREST errors are plain objects, not Error instances. */
function describe(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const { message, code, details } = value as { message?: unknown; code?: unknown; details?: unknown };
    if (typeof message === "string") return [message, code && `(${code})`, details && `- ${details}`].filter(Boolean).join(" ");
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
