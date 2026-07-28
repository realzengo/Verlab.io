import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantCredits } from "@/lib/server/credits";
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
      case "subscription.created":
      case "subscription.active":
      case "subscription.updated":
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
