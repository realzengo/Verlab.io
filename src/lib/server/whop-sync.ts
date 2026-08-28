// Shared Whop -> profiles sync logic, used by both POST /api/webhooks/whop
// (real-time, but not guaranteed to ever be delivered -- see
// 20260802170000_whop_payment_dedup.sql for the incident that proved it)
// and POST /api/checkout/reconcile (a same-request fallback that asks Whop
// directly when the webhook hasn't landed). Both paths must be safe to run
// for the same payment/membership without double-granting credits.
import { createAdminClient } from "@/lib/supabase/admin";
import { grantCredits, deductCredits, getUserCredits } from "@/lib/server/credits";
import { getWhopClient, findCreditPackByPlanId, findSubscriptionPlanByPlanId } from "@/lib/config/whop";
import { capturePostHogEvent } from "@/lib/server/posthog";
import type { Membership } from "@whop/sdk/resources/shared";
import type { RefundCreatedWebhookEvent } from "@whop/sdk/resources/webhooks";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Structural subset shared by the webhook's `Payment` (shared.ts) and the
 * reconciliation endpoint's `PaymentListResponse` (payments.ts) -- both
 * describe the same underlying object, just as separately-generated SDK
 * types, and this is all handlePaymentSucceeded actually reads.
 */
interface PaymentLike {
  id: string;
  metadata: { [key: string]: unknown } | null;
  plan: { id: string } | null;
  membership: { id: string } | null;
}

/**
 * Grants credits for a succeeded payment (subscription period or one-time
 * top-up). Deduped on payment.id via whop_processed_payments -- callable
 * from the webhook (any number of redeliveries, each under its own delivery
 * id) and from reconciliation (no delivery id at all) without risk of
 * granting the same payment's credits twice.
 */
export async function handlePaymentSucceeded(
  admin: AdminClient,
  payment: PaymentLike,
  source: "webhook" | "reconcile"
): Promise<void> {
  const userId = payment.metadata?.user_id as string | undefined;
  const planId = payment.plan?.id;
  if (!userId || !planId) return;

  let credits: number;
  let feature: string;
  if (payment.membership) {
    const plan = findSubscriptionPlanByPlanId(planId);
    if (!plan) return;
    credits = plan.creditsPerPeriod;
    feature = "Subscription credits";
  } else {
    const pack = findCreditPackByPlanId(planId);
    if (!pack) return;
    credits = pack.credits;
    feature = "Credit top-up";
  }

  // Insert-before-grant: 0 rows affected (unique violation on payment_id)
  // means this exact payment was already processed by the other path.
  const { error: dedupeError } = await admin
    .from("whop_processed_payments")
    .insert({ payment_id: payment.id, user_id: userId, credits_granted: credits, source });
  if (dedupeError) {
    if (dedupeError.code === "23505") return;
    throw new Error(dedupeError.message);
  }

  await grantCredits(userId, credits, feature, `whop.payment.${payment.id}`);
  await capturePostHogEvent({
    distinctId: userId,
    event: "purchase_completed",
    properties: { kind: payment.membership ? "subscription" : "credits", planId, credits, source },
  });
}

/**
 * Claws back credits when a one-time top-up payment is refunded (in full or
 * in part -- refund.amount/payment.settlement_amount gives the fraction).
 * Floored at the user's current balance rather than throwing
 * InsufficientCreditsError, so a refund on already-spent credits claws back
 * whatever's left instead of failing the whole webhook. Deliberately skips
 * subscription payments -- their credits are for the period already
 * granted, and subscription access itself is driven by membership.* events.
 *
 * Deduped on refund.id via whop_processed_refunds, same insert-before-mutate
 * idiom as handlePaymentSucceeded above. This matters even with a strict
 * no-refunds policy: a rare forced refund (bank chargeback, dispute Whop
 * settles against you) still fires this webhook, and IMPORTANTLY uses
 * refund.amount -- this specific refund's own amount -- rather than
 * payment.refunded_amount, which is the payment's cumulative refunded total
 * across every refund ever issued against it. Using the cumulative figure
 * would re-claw the full running total on every subsequent refund.created
 * event for the same payment (e.g. two partial refunds), double-deducting
 * credits that an earlier event already clawed back.
 */
export async function handleRefundCreated(admin: AdminClient, refund: RefundCreatedWebhookEvent.Data): Promise<void> {
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

  const refundFraction = payment.settlement_amount > 0 ? refund.amount / payment.settlement_amount : 1;
  const creditsToClaw = Math.round(pack.credits * Math.min(1, Math.max(0, refundFraction)));
  if (creditsToClaw <= 0) return;

  const currentBalance = await getUserCredits(userId);
  const actualClaw = Math.min(creditsToClaw, currentBalance);
  if (actualClaw <= 0) return;

  const { error: dedupeError } = await admin
    .from("whop_processed_refunds")
    .insert({ refund_id: refund.id, user_id: userId, credits_clawed: actualClaw });
  if (dedupeError) {
    if (dedupeError.code === "23505") return;
    throw new Error(dedupeError.message);
  }

  await deductCredits(userId, actualClaw, "Refund clawback", `whop.refund.${refund.id}`);
}

export async function syncMembershipState(admin: AdminClient, membership: Membership): Promise<void> {
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

export async function handleMembershipDeactivated(admin: AdminClient, membership: Membership): Promise<void> {
  const userId = membership.metadata?.user_id as string | undefined;
  if (!userId) return;

  await admin
    .from("profiles")
    .update({ subscription_status: "canceled", plan: "core", plan_set_by: "system" })
    .eq("id", userId);
}
