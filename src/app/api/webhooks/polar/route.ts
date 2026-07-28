import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantCredits, deductCredits, getUserCredits } from "@/lib/server/credits";
import { findCreditPackByProductId, findSubscriptionPlanByProductId } from "@/lib/config/polar";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Not behind Supabase auth (proxy.ts's matcher only covers /app, /admin,
 * /login, /signup) -- auth here IS the Standard Webhooks signature check.
 *
 * Credit grants happen ONLY on order.paid (fired once per successful
 * payment, whether a one-time credit pack or a subscription's initial/
 * renewal charge) -- not on subscription.created/active/updated, which fire
 * for the same billing event under a different event type and would risk a
 * double grant if both were used to hand out credits. Those subscription
 * events are used purely to keep profiles' plan/status columns in sync.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[polar webhook] Missing POLAR_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Signature is an HMAC over the exact raw bytes -- must read text(), not json().
  const body = await request.text();
  const headers = Object.fromEntries(request.headers);

  let event: ReturnType<typeof validateEvent>;
  try {
    event = validateEvent(body, headers, webhookSecret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    throw error;
  }

  const eventId = headers["webhook-id"];
  if (!eventId) {
    return NextResponse.json({ error: "Missing webhook-id header" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error: insertError } = await admin
    .from("polar_webhook_events")
    .insert({ id: eventId, type: event.type, payload: event });

  if (insertError) {
    // Unique violation on id -- this delivery was already processed. Polar
    // retries on non-2xx, so redeliveries must ack without reprocessing.
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error("[polar webhook] Failed to log event:", insertError);
    return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "order.paid":
        await handleOrderPaid(admin, event.data);
        break;
      case "order.refunded":
        await handleOrderRefunded(admin, event.data);
        break;
      case "subscription.created":
      case "subscription.active":
      case "subscription.updated":
      case "subscription.past_due":
      case "subscription.uncanceled":
        // All mirror subscription.status verbatim onto profiles, so any
        // lifecycle event that doesn't need bespoke handling (unlike
        // .revoked below, which additionally downgrades the plan) can share
        // this one path -- proxy.ts's paywall gate reads subscription_status
        // + subscription_current_period_end off the result to decide access,
        // including the past_due grace window.
        await syncSubscriptionState(admin, event.data);
        break;
      case "subscription.canceled":
        await admin
          .from("profiles")
          .update({ subscription_status: "canceled" })
          .eq("subscription_id", event.data.id);
        break;
      case "subscription.revoked":
        // Access actually ends here (vs. .canceled, which just means "won't
        // renew, still active until period end") -- downgrade to the base plan.
        await admin
          .from("profiles")
          .update({ subscription_status: "canceled", plan: "core", plan_set_by: "system" })
          .eq("subscription_id", event.data.id);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`[polar webhook] Failed to process ${event.type}:`, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  await admin.from("polar_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", eventId);

  return NextResponse.json({ received: true });
}

async function handleOrderPaid(admin: AdminClient, order: Order) {
  const userId = order.customer.externalId;
  if (!userId || !order.productId) return;

  if (order.subscriptionId) {
    const plan = findSubscriptionPlanByProductId(order.productId);
    if (!plan) return;
    await grantCredits(
      userId,
      plan.creditsPerPeriod,
      "Subscription credits",
      `polar.subscription.${plan.planId}_${plan.period}`
    );
    return;
  }

  const pack = findCreditPackByProductId(order.productId);
  if (!pack) return;
  await grantCredits(userId, pack.credits, "Credit top-up", `polar.topup.${pack.packId}`);
}

/**
 * Claws back credits when a one-time top-up order is refunded (in full or in
 * part -- refundedAmount/totalAmount gives the fraction). Floored at the
 * user's current balance rather than throwing InsufficientCreditsError, so a
 * refund on already-spent credits claws back whatever's left instead of
 * failing the whole webhook (Polar retries on non-2xx, which would just
 * redeliver the same unsatisfiable deduction forever).
 *
 * Deliberately does NOT touch subscription_status for subscription orders --
 * that's driven entirely by Polar's own subscription.* lifecycle events (see
 * the switch above), so refund handling and subscription-state handling
 * never race to set the same field from two different code paths.
 */
async function handleOrderRefunded(admin: AdminClient, order: Order) {
  const userId = order.customer.externalId;
  if (!userId || !order.productId || order.subscriptionId) return;

  const pack = findCreditPackByProductId(order.productId);
  if (!pack) return;

  const refundFraction = order.totalAmount > 0 ? order.refundedAmount / order.totalAmount : 1;
  const creditsToClaw = Math.round(pack.credits * Math.min(1, Math.max(0, refundFraction)));
  if (creditsToClaw <= 0) return;

  const currentBalance = await getUserCredits(userId);
  const actualClaw = Math.min(creditsToClaw, currentBalance);
  if (actualClaw <= 0) return;

  await deductCredits(userId, actualClaw, "Refund clawback", `polar.refund.${pack.packId}`);
}

async function syncSubscriptionState(admin: AdminClient, subscription: Subscription) {
  const userId = subscription.customer.externalId;
  if (!userId) return;

  const plan = findSubscriptionPlanByProductId(subscription.productId);

  const updates: Record<string, unknown> = {
    polar_customer_id: subscription.customer.id,
    subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_current_period_end: subscription.currentPeriodEnd.toISOString(),
  };
  if (plan) {
    updates.plan = plan.planId;
    updates.plan_set_by = "system";
    updates.subscription_period = plan.period;
  }

  await admin.from("profiles").update(updates).eq("id", userId);
}
