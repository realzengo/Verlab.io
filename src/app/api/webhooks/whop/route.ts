import { NextRequest, NextResponse, after } from "next/server";
import { Webhook } from "standardwebhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  handlePaymentSucceeded,
  handleRefundCreated,
  syncMembershipState,
  handleMembershipDeactivated,
} from "@/lib/server/whop-sync";
import type { Payment, Membership } from "@whop/sdk/resources/shared";
import type { RefundCreatedWebhookEvent } from "@whop/sdk/resources/webhooks";

/** Room for after() to finish processing once the 200 has gone out. */
export const maxDuration = 60;

type WhopEvent = { id: string; type: string; data: unknown };
type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Not behind Supabase auth (proxy.ts's matcher only covers /app, /admin,
 * /login, /signup) -- auth here IS the Standard Webhooks signature check.
 *
 * Every path answers 200. Whop counts any non-2xx, redirect or >5s response
 * as a failure and disables the endpoint after 72h of them, which is what
 * lost every payment from August to November 2026. Nothing that fails here
 * is lost: cron/whop-sync replays the last 3 days of payments, refunds and
 * memberships from Whop's API every 10 minutes through the same handlers.
 * A request that fails the signature check is acked but never stored or
 * processed, so answering 200 to it gives a forger nothing.
 *
 * Credit grants happen ONLY on payment.succeeded (fired once per successful
 * charge, whether a one-time credit pack or a subscription's initial/renewal
 * charge) -- not on membership.activated, which fires for the same billing
 * event under a different event type and would risk a double grant if both
 * granted credits. membership.* events are used purely to keep profiles'
 * plan/status columns in sync.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[whop webhook] Missing WHOP_WEBHOOK_SECRET; delivery acked but not processed");
      return ack({ received: true, processed: false });
    }

    // Signature is an HMAC over the exact raw bytes -- must read text(), not json().
    const body = await request.text();
    const headers = Object.fromEntries(request.headers);

    const event = verify(body, headers, webhookSecret);
    if (!event) {
      console.error("[whop webhook] Rejected delivery (bad signature or payload); acked but ignored", {
        webhookId: headers["webhook-id"] ?? null,
        hasSignature: Boolean(headers["webhook-signature"]),
      });
      return ack({ received: false });
    }

    const admin = createAdminClient();

    const { error: insertError } = await admin
      .from("whop_webhook_events")
      .insert({ id: event.id, type: event.type, payload: event });

    if (insertError) {
      // Unique violation on id -- this delivery was already stored. Whop
      // retries reuse the same webhook-id, so redeliveries ack without
      // reprocessing.
      if (insertError.code === "23505") {
        return ack({ received: true, deduped: true });
      }
      // Any other insert failure (e.g. a transient Supabase timeout) still
      // acks; the raw payload is only in this log, since the insert itself
      // is what failed. cron/whop-sync picks the object up from Whop's API.
      console.error("[whop webhook] Failed to log event:", insertError, JSON.stringify(event));
      return ack({ received: true, logged: false });
    }

    // The event is durably stored, so answer Whop now and process after the
    // response: credit grants and Whop API lookups can outlast Whop's 5s
    // budget. A failure here leaves processed_at null for backfill.
    after(() => processEvent(admin, event));

    return ack({ received: true });
  } catch (error) {
    console.error("[whop webhook] Unexpected error; delivery acked:", error);
    return ack({ received: true, processed: false });
  }
}

function ack(body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status: 200 });
}

/**
 * Whop signs with HMAC-SHA256 keyed by the literal `ws_...` secret string
 * (per docs.whop.com/developer/guides/webhooks), so the key is the secret's
 * raw bytes. The old code rewrote `ws_X` to `whsec_X`, which makes
 * standardwebhooks base64-decode X into different key bytes -- every real
 * delivery failed verification. That reading is kept only as a fallback.
 * Returns null on any verification or parse failure.
 */
function verify(body: string, headers: Record<string, string>, secret: string): WhopEvent | null {
  const keys: Array<() => Webhook> = [() => new Webhook(secret, { format: "raw" })];
  if (secret.startsWith("ws_")) keys.push(() => new Webhook(`whsec_${secret.slice(3)}`));
  else if (secret.startsWith("whsec_")) keys.push(() => new Webhook(secret));

  for (const makeKey of keys) {
    try {
      makeKey().verify(body, headers);
    } catch {
      continue;
    }
    try {
      const parsed = JSON.parse(body) as Partial<WhopEvent>;
      if (typeof parsed?.id !== "string" || typeof parsed?.type !== "string") {
        console.error("[whop webhook] Verified payload has no id/type");
        return null;
      }
      return parsed as WhopEvent;
    } catch {
      console.error("[whop webhook] Verified payload is not valid JSON");
      return null;
    }
  }
  return null;
}

async function processEvent(admin: AdminClient, event: WhopEvent): Promise<void> {
  try {
    switch (event.type) {
      case "payment.succeeded":
        await handlePaymentSucceeded(admin, event.data as Payment, "webhook");
        break;
      case "refund.created":
        await handleRefundCreated(admin, event.data as RefundCreatedWebhookEvent.Data);
        break;
      case "membership.activated":
      case "membership.cancel_at_period_end_changed":
        await syncMembershipState(admin, event.data as Membership);
        break;
      case "membership.deactivated":
        // Access actually ends here (vs. cancel_at_period_end_changed, which
        // just means "won't renew, still active until period end") --
        // downgrade to the base plan.
        await handleMembershipDeactivated(admin, event.data as Membership);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`[whop webhook] Failed to process ${event.type} ${event.id}:`, error);
    return;
  }

  const { error } = await admin
    .from("whop_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", event.id);
  if (error) console.error(`[whop webhook] Failed to mark ${event.id} processed:`, error);
}
