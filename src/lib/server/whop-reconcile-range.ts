// Bulk Whop -> Supabase reconciliation over a date window, for recovering
// from a stretch where the database was unreachable and POST
// /api/webhooks/whop therefore dropped events.
//
// This exists because that route acks 200 when its whop_webhook_events
// insert fails (deliberately -- returning non-2xx once got the endpoint
// disabled by Whop after 72h of continuous failures). A 200 tells Whop the
// delivery succeeded, so Whop never retries: every renewal, refund and
// cancellation in that window is gone from the DB with no redelivery
// coming. Whop's own API is the only surviving record, and this replays it.
//
// Everything here routes through the same handlers the webhook uses, all of
// which dedupe on the upstream object's own id (whop_processed_payments /
// whop_processed_refunds), so running this repeatedly -- or over a window
// that overlaps events the webhook did land -- cannot double-grant or
// double-claw.
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhopClient, getWhopCompanyId } from "@/lib/config/whop";
import {
  handlePaymentSucceeded,
  handleRefundCreated,
  syncMembershipState,
  handleMembershipDeactivated,
} from "@/lib/server/whop-sync";
import type { MembershipStatus } from "@whop/sdk/resources/shared";
import type { MembershipListResponse } from "@whop/sdk/resources/memberships";

type AdminClient = ReturnType<typeof createAdminClient>;
type WhopClient = ReturnType<typeof getWhopClient>;

/**
 * Still entitled to the plan. `canceling` is cancel_at_period_end -- the
 * user has cancelled but paid through the end of the period, so downgrading
 * them now would cut access they are still owed. `past_due` keeps the plan
 * too; syncMembershipState records the status so dunning is visible without
 * revoking access mid-retry.
 */
const ACTIVE_STATUSES: readonly MembershipStatus[] = ["trialing", "active", "past_due", "canceling"];

/** Definitively over -- access should be gone. */
const ENDED_STATUSES: readonly MembershipStatus[] = ["canceled", "expired", "completed"];

// `drafted` (a checkout that never completed) and `unresolved` (Whop itself
// could not settle the state) are in neither list on purpose: neither is
// evidence that a paying user should be downgraded, and guessing wrong here
// revokes a plan someone paid for. They are counted and reported instead.

/** Hard ceiling per collection, so a bad window can't spin forever inside one request. */
const MAX_ITEMS = 5000;

export interface ReconcileRangeOptions {
  since: string;
  until: string;
  /** Report what would change without writing anything. */
  dryRun: boolean;
  /**
   * Memberships are swept in full rather than by date (see
   * reconcileMemberships). Skip it to reconcile only money movement.
   */
  includeMemberships: boolean;
}

export interface ReconcileRangeResult {
  window: { since: string; until: string };
  dryRun: boolean;
  payments: { scanned: number; granted: number };
  refunds: { scanned: number; clawedBack: number };
  memberships: {
    scanned: number;
    users: number;
    synced: number;
    deactivated: number;
    skippedAdminSet: number;
    skippedIndeterminate: number;
  };
  /** Per-item failures. One bad record is recorded and skipped, never fatal. */
  errors: string[];
}

/**
 * Replays succeeded payments in the window. `statuses: ["paid"]` matches the
 * webhook's payment.succeeded trigger -- a payment that later failed or was
 * voided must not grant credits.
 */
async function reconcilePayments(
  admin: AdminClient,
  client: WhopClient,
  options: ReconcileRangeOptions,
  result: ReconcileRangeResult
): Promise<void> {
  const payments = client.payments.list({
    company_id: getWhopCompanyId(),
    statuses: ["paid"],
    created_after: options.since,
    created_before: options.until,
    order: "created_at",
    direction: "asc",
  });

  for await (const payment of payments) {
    if (result.payments.scanned >= MAX_ITEMS) {
      result.errors.push(`payments: hit the ${MAX_ITEMS}-item cap; narrow the window and re-run`);
      break;
    }
    result.payments.scanned++;

    // A grant only happens if this payment isn't already in
    // whop_processed_payments, so the dry run can't just count scanned rows.
    if (options.dryRun) {
      const { data: seen } = await admin
        .from("whop_processed_payments")
        .select("payment_id")
        .eq("payment_id", payment.id)
        .maybeSingle();
      if (!seen) result.payments.granted++;
      continue;
    }

    try {
      const before = await admin
        .from("whop_processed_payments")
        .select("payment_id")
        .eq("payment_id", payment.id)
        .maybeSingle();
      await handlePaymentSucceeded(admin, payment, "reconcile");
      if (!before.data) result.payments.granted++;
    } catch (error) {
      result.errors.push(`payment ${payment.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Replays succeeded refunds in the window. Only `succeeded` ones -- a
 * pending or failed refund hasn't moved money and must not claw back
 * credits.
 */
async function reconcileRefunds(
  admin: AdminClient,
  client: WhopClient,
  options: ReconcileRangeOptions,
  result: ReconcileRangeResult
): Promise<void> {
  const refunds = client.refunds.list({
    company_id: getWhopCompanyId(),
    created_after: options.since,
    created_before: options.until,
  });

  for await (const refund of refunds) {
    if (result.refunds.scanned >= MAX_ITEMS) {
      result.errors.push(`refunds: hit the ${MAX_ITEMS}-item cap; narrow the window and re-run`);
      break;
    }
    if (refund.status !== "succeeded") continue;
    result.refunds.scanned++;

    if (options.dryRun) {
      const { data: seen } = await admin
        .from("whop_processed_refunds")
        .select("refund_id")
        .eq("refund_id", refund.id)
        .maybeSingle();
      if (!seen) result.refunds.clawedBack++;
      continue;
    }

    try {
      const before = await admin
        .from("whop_processed_refunds")
        .select("refund_id")
        .eq("refund_id", refund.id)
        .maybeSingle();
      await handleRefundCreated(admin, refund);
      if (!before.data) result.refunds.clawedBack++;
    } catch (error) {
      result.errors.push(`refund ${refund.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Unlike payments and refunds, memberships are swept in FULL, ignoring the
 * date window. A cancellation during the outage belongs to a membership
 * created long before it, and MembershipListParams can only filter on
 * created_at -- so a date-filtered sweep would miss exactly the cancelled
 * subscribers this is meant to find (still marked paid in `profiles`,
 * still being served).
 *
 * Whop is the source of truth for current state, so this doesn't replay
 * events at all: it reads where every membership stands now and writes that.
 * That repairs a missed cancellation without needing the lost event.
 *
 * Grouped by user first, because a user can hold several memberships (an
 * expired one plus a current one after re-subscribing). Iterating flat would
 * let a stale `expired` row downgrade someone who is actively paying,
 * purely depending on page order -- so an active membership anywhere in a
 * user's set wins, and only a user whose every membership has definitively
 * ended is deactivated.
 */
async function reconcileMemberships(
  admin: AdminClient,
  client: WhopClient,
  options: ReconcileRangeOptions,
  result: ReconcileRangeResult
): Promise<void> {
  const memberships = client.memberships.list({
    company_id: getWhopCompanyId(),
    order: "created_at",
    direction: "asc",
  });

  const byUser = new Map<string, MembershipListResponse[]>();
  for await (const membership of memberships) {
    if (result.memberships.scanned >= MAX_ITEMS) {
      result.errors.push(`memberships: hit the ${MAX_ITEMS}-item cap; sweep skipped past this point`);
      break;
    }
    result.memberships.scanned++;

    // Same guard the webhook handlers apply: without our own user_id in
    // metadata there is no profile to point at.
    const userId = membership.metadata?.user_id;
    if (typeof userId !== "string" || !userId) continue;

    const existing = byUser.get(userId);
    if (existing) existing.push(membership);
    else byUser.set(userId, [membership]);
  }

  result.memberships.users = byUser.size;
  if (byUser.size === 0) return;

  // An admin-granted plan (plan_set_by = 'admin') is a deliberate override
  // -- a comp, a support credit -- that no longer tracks Whop. The webhook
  // stomps it, but it only ever fires on a real deactivation happening right
  // then; a bulk sweep would re-apply every long-dead membership at once and
  // silently strip comps that were never Whop-governed. Deactivation is
  // therefore limited to profiles still marked 'system'.
  const userIds = [...byUser.keys()];
  const systemManaged = new Set<string>();
  const PROFILE_CHUNK = 200;
  for (let i = 0; i < userIds.length; i += PROFILE_CHUNK) {
    const chunk = userIds.slice(i, i + PROFILE_CHUNK);
    const { data, error } = await admin.from("profiles").select("id, plan_set_by").in("id", chunk);
    if (error) {
      result.errors.push(`profiles lookup: ${error.message}`);
      return;
    }
    for (const row of data ?? []) {
      if (row.plan_set_by === "system") systemManaged.add(row.id as string);
    }
  }

  for (const [userId, list] of byUser) {
    const active = list.find((m) => ACTIVE_STATUSES.includes(m.status));

    if (active) {
      if (options.dryRun) {
        result.memberships.synced++;
        continue;
      }
      try {
        await syncMembershipState(admin, active);
        result.memberships.synced++;
      } catch (error) {
        result.errors.push(`membership ${active.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
      continue;
    }

    if (!list.every((m) => ENDED_STATUSES.includes(m.status))) {
      result.memberships.skippedIndeterminate++;
      continue;
    }

    if (!systemManaged.has(userId)) {
      result.memberships.skippedAdminSet++;
      continue;
    }

    const latest = list[list.length - 1];
    if (options.dryRun) {
      result.memberships.deactivated++;
      continue;
    }
    try {
      await handleMembershipDeactivated(admin, latest);
      result.memberships.deactivated++;
    } catch (error) {
      result.errors.push(`membership ${latest.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export async function reconcileWhopRange(options: ReconcileRangeOptions): Promise<ReconcileRangeResult> {
  const admin = createAdminClient();
  const client = getWhopClient();

  const result: ReconcileRangeResult = {
    window: { since: options.since, until: options.until },
    dryRun: options.dryRun,
    payments: { scanned: 0, granted: 0 },
    refunds: { scanned: 0, clawedBack: 0 },
    memberships: {
      scanned: 0,
      users: 0,
      synced: 0,
      deactivated: 0,
      skippedAdminSet: 0,
      skippedIndeterminate: 0,
    },
    errors: [],
  };

  // Order matters: grant first, then claw back, then set plan state. A
  // payment refunded inside the same window nets out correctly only in
  // that order.
  await reconcilePayments(admin, client, options, result);
  await reconcileRefunds(admin, client, options, result);
  if (options.includeMemberships) {
    await reconcileMemberships(admin, client, options, result);
  }

  return result;
}
