import { NextRequest, NextResponse } from "next/server";
import { WebhookVerificationError } from "standardwebhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantCredits, deductCredits, getUserCredits } from "@/lib/server/credits";
import { getWhopClient, findCreditPackByPlanId, findSubscriptionPlanByPlanId } from "@/lib/config/whop";
import type { Payment, Membership } from "@whop/sdk/resources/shared";
import type { UnwrapWebhookEvent, RefundCreatedWebhookEvent } from "@whop/sdk/resources/webhooks";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Not behind Supabase auth (proxy.ts's matcher only covers /app, /admin,
 * /login, /signup) -- auth here IS the Standard Webhooks signature check
 * (same underlying spec Polar used, via the `standardwebhooks` package
 * @whop/sdk wraps in client.webhooks.unwrap()).
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
        await handlePaymentSucceeded(admin, event.data as Payment);
        break;
      case "refund.created":
        await handleRefundCreated(admin, event.data as RefundCreatedWebhookEvent.Data);
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

async function handlePaymentSucceeded(admin: AdminClient, payment: Payment) {
  const userId = payment.metadata?.user_id as string | undefined;
  const planId = payment.plan?.id;
  if (!userId || !planId) return;

  if (payment.membership) {
    const plan = findSubscriptionPlanByPlanId(planId);
    if (!plan) return;
    await grantCredits(
      userId,
      plan.creditsPerPeriod,
      "Subscription credits",
      `whop.subscription.${plan.planId}_${plan.period}`
    );
    return;
  }

  const pack = findCreditPackByPlanId(planId);
  if (!pack) return;
  await grantCredits(userId, pack.credits, "Credit top-up", `whop.topup.${pack.packId}`);
}

/**
 * Claws back credits when a one-time top-up payment is refunded (in full or
 * in part -- refund.amount/payment.settlement_amount gives the fraction).
 * Floored at the user's current balance rather than throwing
 * InsufficientCreditsError, so a refund on already-spent credits claws back
 * whatever's left instead of failing the whole webhook (Whop retries on
 * non-2xx, which would just redeliver the same unsatisfiable deduction
 * forever). Deliberately skips subscription payments -- their credits are
 * for the period already granted, and subscription access itself is driven
 * entirely by membership.* events, not refund handling.
 */
async function handleRefundCreated(admin: AdminClient, refund: RefundCreatedWebhookEvent.Data) {
  const paymentId = refund.payment?.id;
  if (!paymentId) return;

  const client = getWhopClient();
  const payment = await client.payments.retrieve(paymentId);
  if (!payment) return;

  const userId = payment.metadata?.user_id as string | undefined;
  const planId = payment.plan?.id;
  if (!userId || !planId || payment.membership) return;

  const pack = findCreditPackByPlanId(planId);
  if (!pack) return;

  const refundFraction = payment.settlement_amount > 0 ? (payment.refunded_amount ?? 0) / payment.settlement_amount : 1;
  const creditsToClaw = Math.round(pack.credits * Math.min(1, Math.max(0, refundFraction)));
  if (creditsToClaw <= 0) return;

  const currentBalance = await getUserCredits(userId);
  const actualClaw = Math.min(creditsToClaw, currentBalance);
  if (actualClaw <= 0) return;

  await deductCredits(userId, actualClaw, "Refund clawback", `whop.refund.${pack.packId}`);
}

async function syncMembershipState(admin: AdminClient, membership: Membership) {
  const userId = membership.metadata?.user_id as string | undefined;
  if (!userId) return;

  const plan = findSubscriptionPlanByPlanId(membership.plan.id);

  const updates: Record<string, unknown> = {
    subscription_id: membership.id,
    subscription_status: membership.status,
    subscription_current_period_end: membership.renewal_period_end
      ? new Date(Number(membership.renewal_period_end) * 1000).toISOString()
      : null,
    whop_manage_url: membership.manage_url,
  };
  if (plan) {
    updates.plan = plan.planId;
    updates.plan_set_by = "system";
    updates.subscription_period = plan.period;
  }

  await admin.from("profiles").update(updates).eq("id", userId);
}

async function handleMembershipDeactivated(admin: AdminClient, membership: Membership) {
  const userId = membership.metadata?.user_id as string | undefined;
  if (!userId) return;

  await admin
    .from("profiles")
    .update({ subscription_status: "canceled", plan: "core", plan_set_by: "system" })
    .eq("id", userId);
}
