// Backend for the in-app cancellation flow (Settings > Subscription > Cancel
// subscription): a short exit survey plus one retention offer, used by
// POST /api/billing/cancel/offer and POST /api/billing/cancel. Whop's own
// Membership.cancel_option/cancellation_reason fields are read-only (set by
// Whop's hosted cancel UI, not the API), so cancellation_feedback is our own
// record of *why* someone tried to cancel and whether the offer worked --
// the membership mutation itself still goes through the Whop SDK so billing
// state stays authoritative there, synced back inline the same way
// /api/checkout/reconcile does rather than waiting on webhook delivery.
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhopClient } from "@/lib/config/whop";
import { syncMembershipState } from "@/lib/server/whop-sync";
import { capturePostHogEvent } from "@/lib/server/posthog";
import { RETENTION_OFFER_FREE_DAYS, type CancellationReason } from "@/lib/cancellation";
import type { Membership } from "@whop/sdk/resources/shared";

export { isCancellationReason } from "@/lib/cancellation";

const FEEDBACK_MAX = 2000;

function truncateFeedback(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, FEEDBACK_MAX) : null;
}

export class NoActiveSubscriptionError extends Error {
  constructor() {
    super("No active subscription to manage");
    this.name = "NoActiveSubscriptionError";
  }
}

async function loadSubscriberProfile(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<{ subscriptionId: string; plan: string | null }> {
  const { data } = await admin.from("profiles").select("subscription_id, plan").eq("id", userId).single();
  if (!data?.subscription_id) {
    throw new NoActiveSubscriptionError();
  }
  return { subscriptionId: data.subscription_id, plan: data.plan };
}

function periodEndIso(membership: Membership): string | null {
  return membership.renewal_period_end ? new Date(Number(membership.renewal_period_end) * 1000).toISOString() : null;
}

export interface RetentionOfferResult {
  freeDays: number;
  newPeriodEnd: string | null;
}

/**
 * Accepts the "more time to decide" retention offer shown before a
 * cancellation is finalized: extends the current billing period by
 * RETENTION_OFFER_FREE_DAYS via Whop, syncs the resulting membership onto
 * the profile immediately, and logs the attempt as 'retained' so it still
 * shows up in churn analytics even though nothing was actually canceled.
 */
export async function applyRetentionOffer(
  userId: string,
  reason: CancellationReason,
  reasonDetail?: string
): Promise<RetentionOfferResult> {
  const admin = createAdminClient();
  const profile = await loadSubscriberProfile(admin, userId);

  const membership = await getWhopClient().memberships.addFreeDays(profile.subscriptionId, {
    free_days: RETENTION_OFFER_FREE_DAYS,
  });
  await syncMembershipState(admin, membership as Membership);

  await admin.from("cancellation_feedback").insert({
    user_id: userId,
    subscription_id: profile.subscriptionId,
    plan: profile.plan,
    reason,
    reason_detail: truncateFeedback(reasonDetail),
    offer_shown: true,
    offer_accepted: true,
    free_days_granted: RETENTION_OFFER_FREE_DAYS,
    outcome: "retained",
  });

  await capturePostHogEvent({
    distinctId: userId,
    event: "cancellation_retention_offer_accepted",
    properties: { reason, freeDays: RETENTION_OFFER_FREE_DAYS },
  });

  return { freeDays: RETENTION_OFFER_FREE_DAYS, newPeriodEnd: periodEndIso(membership as Membership) };
}

export interface CancellationResult {
  effectiveDate: string | null;
}

/**
 * Finalizes a cancellation: schedules the Whop membership to cancel at the
 * end of the current billing period (access is kept through the period
 * already paid for -- see hasActiveSubscription()'s CANCELED_STATUSES
 * handling), syncs the result inline, and logs the full exit-survey trail.
 */
export async function submitCancellation(
  userId: string,
  input: { reason: CancellationReason; reasonDetail?: string; additionalFeedback?: string; offerShown: boolean }
): Promise<CancellationResult> {
  const admin = createAdminClient();
  const profile = await loadSubscriberProfile(admin, userId);

  const membership = await getWhopClient().memberships.cancel(profile.subscriptionId, {
    cancellation_mode: "at_period_end",
  });
  await syncMembershipState(admin, membership as Membership);

  await admin.from("cancellation_feedback").insert({
    user_id: userId,
    subscription_id: profile.subscriptionId,
    plan: profile.plan,
    reason: input.reason,
    reason_detail: truncateFeedback(input.reasonDetail),
    additional_feedback: truncateFeedback(input.additionalFeedback),
    offer_shown: input.offerShown,
    offer_accepted: false,
    free_days_granted: 0,
    outcome: "canceled",
  });

  await capturePostHogEvent({
    distinctId: userId,
    event: "subscription_canceled",
    properties: { reason: input.reason, offerShown: input.offerShown },
  });

  return { effectiveDate: periodEndIso(membership as Membership) };
}
