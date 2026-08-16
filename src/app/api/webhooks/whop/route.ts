import { NextRequest, NextResponse } from "next/server";
import { WebhookVerificationError } from "standardwebhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhopClient } from "@/lib/config/whop";
import {
  handlePaymentSucceeded,
  handleRefundCreated,
  syncMembershipState,
  handleMembershipDeactivated,
} from "@/lib/server/whop-sync";
import type { Payment, Membership } from "@whop/sdk/resources/shared";
import type { UnwrapWebhookEvent, RefundCreatedWebhookEvent } from "@whop/sdk/resources/webhooks";

/**
 * Not behind Supabase auth (proxy.ts's matcher only covers /app, /admin,
 * /login, /signup) -- auth here IS the Standard Webhooks signature check,
 * via the `standardwebhooks` package @whop/sdk wraps in
 * client.webhooks.unwrap().
 *
 * Credit grants happen ONLY on payment.succeeded (fired once per successful
 * charge, whether a one-time credit pack or a subscription's initial/renewal
 * charge) -- not on membership.activated, which fires for the same billing
 * event under a different event type and would risk a double grant if both
 * granted credits. membership.* events are used purely to keep profiles'
 * plan/status columns in sync.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[whop webhook] Missing WHOP_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Signature is an HMAC over the exact raw bytes -- must read text(), not json().
  const body = await request.text();
  const headers = Object.fromEntries(request.headers);

  // @whop/sdk's unwrap() delegates to the generic `standardwebhooks` package,
  // which only recognizes the `whsec_` prefix before base64-decoding the
  // key -- Whop's own dashboard issues secrets as `ws_<base64>` instead, so
  // passed through unmodified the literal "ws_" text fails base64 decoding
  // (its underscore isn't in the base64 alphabet). Re-prefixing is a pure
  // string swap, not a re-encoding -- what follows `ws_` is already the same
  // base64 payload `whsec_` would expect (confirmed against Whop's docs,
  // which describe the secret as base64-decoded per the Standard Webhooks spec).
  const normalizedSecret = webhookSecret.startsWith("ws_") ? `whsec_${webhookSecret.slice(3)}` : webhookSecret;

  let event: UnwrapWebhookEvent & { id: string; type: string };
  try {
    event = getWhopClient().webhooks.unwrap(body, { headers, key: normalizedSecret }) as typeof event;
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    throw error;
  }

  const admin = createAdminClient();

  const { error: insertError } = await admin
    .from("whop_webhook_events")
    .insert({ id: event.id, type: event.type, payload: event });

  if (insertError) {
    // Unique violation on id -- this delivery was already processed. Whop
    // retries on non-2xx, so redeliveries must ack without reprocessing.
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error("[whop webhook] Failed to log event:", insertError);
    return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "payment.succeeded":
        await handlePaymentSucceeded(admin, event.data as Payment, "webhook");
        break;
      case "refund.created":
        await handleRefundCreated(event.data as RefundCreatedWebhookEvent.Data);
        break;
      case "membership.activated":
        await syncMembershipState(admin, event.data as Membership);
        break;
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
    console.error(`[whop webhook] Failed to process ${event.type}:`, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  await admin.from("whop_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);

  return NextResponse.json({ received: true });
}
