// Shared Whop -> profiles sync logic, used by both POST /api/webhooks/whop
// (real-time, but not guaranteed to ever be delivered -- see
// 20260802170000_whop_payment_dedup.sql for the incident that proved it)
// and POST /api/checkout/reconcile (a same-request fallback that asks Whop
// directly when the webhook hasn't landed). Both paths must be safe to run
// for the same payment/membership without double-granting credits.
import { createAdminClient } from "@/lib/supabase/admin";
import { grantCredits, deductCredits, getUserCredits } from "@/lib/server/credits";
import { getWhopClient, getWhopCompanyId, findCreditPackByPlanId, findSubscriptionPlanByPlanId } from "@/lib/config/whop";
import { capturePostHogEvent } from "@/lib/server/posthog";
import type { MembershipStatus } from "@whop/sdk/resources/shared";

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
 * Same structural-subset trick as PaymentLike above, for the refund shape:
 * the webhook's `RefundCreatedWebhookEvent.Data` and the reconciliation
 * sweep's `RefundListResponse` are separately-generated types for the same
 * object, and these three fields are all handleRefundCreated reads.
 */
interface RefundLike {
  id: string;
  amount: number;
  payment: { id: string } | null;
}

/**
 * Structural subset again, for memberships. `Membership` (the webhook's
 * type) and `MembershipListResponse` (the reconciliation sweep's) differ
 * only by fields nothing here reads -- notably `custom_field_responses`,
 * required on the former and absent on the latter, which is enough to stop
 * a listed membership assigning to `Membership` even though every field
 * below is identical on both.
 */
interface MembershipLike {
  id: string;
  metadata: { [key: string]: unknown } | null;
  plan: { id: string };
  status: MembershipStatus;
  renewal_period_end: string | null;
  manage_url: string | null;
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
  const planId = payment.plan?.id;
  if (!planId) {
    console.error(`[whop] payment ${payment.id} has no plan; no credits granted`);
    return;
  }

  const userId = await resolvePaymentUserId(admin, payment);
  if (!userId) {
    // Not ours to credit (no Verlab account behind it). Loud, so a real
    // customer missing here shows up in the logs instead of vanishing.
    console.error(`[whop] payment ${payment.id} (${planId}) has no Verlab user; no credits granted`);
    return;
  }

  let credits: number;
  let feature: string;
  if (payment.membership) {
    const plan = findSubscriptionPlanByPlanId(planId);
    if (!plan) {
      console.error(`[whop] payment ${payment.id}: subscription plan ${planId} isn't in src/lib/config/whop.ts; no credits granted`);
      return;
    }
    credits = plan.creditsPerPeriod;
    feature = "Subscription credits";
  } else {
    const pack = findCreditPackByPlanId(planId);
    if (!pack) {
      console.error(`[whop] payment ${payment.id}: credit pack plan ${planId} isn't in src/lib/config/whop.ts; no credits granted`);
      return;
    }
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

  try {
    await grantCredits(userId, credits, feature, `whop.payment.${payment.id}`);
  } catch (error) {
    // Release the claim, or this payment would read as processed forever and
    // no retry (the next webhook delivery, checkout sync or the 10-minute
    // whop-sync cron) would ever grant it.
    await admin.from("whop_processed_payments").delete().eq("payment_id", payment.id);
    throw error;
  }

  await capturePostHogEvent({
    distinctId: userId,
    event: "purchase_completed",
    properties: { kind: payment.membership ? "subscription" : "credits", planId, credits, source },
  });
}

/**
 * Who a payment belongs to. Checkout stamps our user id into the payment's
 * metadata, but a renewal is a new payment Whop creates on its own, so don't
 * rely on that alone: fall back to the membership's metadata (stamped by the
 * same checkout), then to the profile that holds this membership.
 */
async function resolvePaymentUserId(admin: AdminClient, payment: PaymentLike): Promise<string | null> {
  const fromPayment = payment.metadata?.user_id;
  if (typeof fromPayment === "string" && fromPayment) return fromPayment;
  if (!payment.membership) return null;

  try {
    const membership = await getWhopClient().memberships.retrieve(payment.membership.id);
    const fromMembership = membership.metadata?.user_id;
    if (typeof fromMembership === "string" && fromMembership) return fromMembership;
  } catch (error) {
    console.error(`[whop] couldn't load membership ${payment.membership.id} for payment ${payment.id}:`, error);
  }

  const { data } = await admin.from("profiles").select("id").eq("subscription_id", payment.membership.id).maybeSingle();
  return (data?.id as string | undefined) ?? null;
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
export async function handleRefundCreated(admin: AdminClient, refund: RefundLike): Promise<void> {
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

/**
 * Whop's SDK types renewal_period_end as a string, and the API returns ISO
 * 8601 ("2027-09-05T15:10:23.460Z"). Older code assumed unix seconds, which
 * turned every real value into an Invalid Date that throws on toISOString().
 * Accept both, and drop anything unparseable rather than failing the sync.
 */
export function whopTimestampToIso(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const asNumber = Number(value);
  const date = Number.isFinite(asNumber) ? new Date(asNumber * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function syncMembershipState(admin: AdminClient, membership: MembershipLike): Promise<void> {
  const userId = membership.metadata?.user_id as string | undefined;
  if (!userId) return;

  const plan = findSubscriptionPlanByPlanId(membership.plan.id);

  const updates: Record<string, unknown> = {
    subscription_id: membership.id,
    subscription_status: membership.status,
    subscription_current_period_end: whopTimestampToIso(membership.renewal_period_end),
    whop_manage_url: membership.manage_url,
  };
  if (plan) {
    updates.plan = plan.planId;
    updates.plan_set_by = "system";
    updates.subscription_period = plan.period;
  }

  await admin.from("profiles").update(updates).eq("id", userId);
}

export async function handleMembershipDeactivated(admin: AdminClient, membership: MembershipLike): Promise<void> {
  const userId = membership.metadata?.user_id as string | undefined;
  if (!userId) return;

  await admin
    .from("profiles")
    .update({ subscription_status: "canceled", plan: "core", plan_set_by: "system" })
    .eq("id", userId);
}

/**
 * Logs an object a reconciliation path found (a payment, refund or
 * membership read from Whop's API) into whop_webhook_events, the same table
 * the webhook writes, so the admin's revenue view sees money that arrived
 * while the webhook was down. The id is derived from the object's own id,
 * so repeated sweeps write it once; getRevenueData dedupes on the object id
 * too, so a webhook delivery landing later for the same payment isn't
 * counted twice. Dated at when it happened on Whop, not when it was found.
 */
export async function recordReconciledEvent(
  admin: AdminClient,
  type: "payment.succeeded" | "refund.created" | "membership.activated",
  object: { id: string },
  occurredAt: string | null | undefined
): Promise<void> {
  const { error } = await admin.from("whop_webhook_events").insert({
    id: `reconcile:${type}:${object.id}`,
    type,
    payload: { type, source: "reconcile", data: object },
    created_at: occurredAt ?? new Date().toISOString(),
    processed_at: new Date().toISOString(),
  });
  if (error && error.code !== "23505") throw new Error(error.message);
}

/** Where Whop should deliver events; matches the endpoint registered in Whop. */
const WEBHOOK_PATH = "/api/webhooks/whop";

/**
 * Whop disables a webhook endpoint by itself after a stretch of failed
 * deliveries (it happened after the August outage, and nothing arrived for
 * three months). Turns any of ours that are off back on, and reports what it
 * found. A no-op when everything is already enabled.
 */
export async function ensureWhopWebhookEnabled(): Promise<{ found: number; reenabled: string[] }> {
  const client = getWhopClient();
  const companyId = getWhopCompanyId();
  const reenabled: string[] = [];
  let found = 0;
  for await (const hook of client.webhooks.list({ company_id: companyId })) {
    if (!hook.url?.endsWith(WEBHOOK_PATH)) continue;
    found++;
    if (hook.enabled) continue;
    await client.webhooks.update(hook.id, { enabled: true });
    reenabled.push(hook.id);
  }
  return { found, reenabled };
}

/** Whether Whop currently delivers to our endpoint; null when Whop can't be asked. */
export async function getWhopWebhookEnabled(): Promise<boolean | null> {
  try {
    const client = getWhopClient();
    const companyId = getWhopCompanyId();
    let any = false;
    for await (const hook of client.webhooks.list({ company_id: companyId })) {
      if (!hook.url?.endsWith(WEBHOOK_PATH)) continue;
      if (hook.enabled) return true;
      any = true;
    }
    return any ? false : null;
  } catch {
    return null;
  }
}
