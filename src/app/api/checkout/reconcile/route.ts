import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhopClient, getWhopCompanyId } from "@/lib/config/whop";
import { handlePaymentSucceeded, syncMembershipState } from "@/lib/server/whop-sync";

/**
 * Fallback for when POST /api/webhooks/whop never lands -- confirmed to
 * happen in production (a real Pro subscription payment/membership went
 * through on Whop's side, but zero webhook row for it ever reached
 * whop_webhook_events; see 20260802170000_whop_payment_dedup.sql). Called by
 * CheckoutSyncScreen so a paying user's plan/credits self-heal within this
 * same request instead of depending entirely on webhook delivery.
 *
 * Asks Whop directly for this user's most recent payment (searched by email
 * -- the only caller-scoped filter payments.list supports that we can
 * always provide) and replays it through the same handlers the webhook
 * uses, which dedupe on the payment's own id, so this is safe to call
 * repeatedly and safe to run even if the webhook does eventually land too.
 */
export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const client = getWhopClient();
  const admin = createAdminClient();

  try {
    const payments = await client.payments.list({
      company_id: getWhopCompanyId(),
      query: user.email,
      statuses: ["paid"],
      order: "created_at",
      direction: "desc",
    });

    let processed = false;
    let count = 0;
    for await (const payment of payments) {
      count++;
      if (count > 5) break;
      if (payment.metadata?.user_id !== user.id) continue;

      await handlePaymentSucceeded(admin, payment, "reconcile");

      if (payment.membership) {
        const membership = await client.memberships.retrieve(payment.membership.id);
        await syncMembershipState(admin, membership);
      }
      processed = true;
    }

    return NextResponse.json({ processed });
  } catch (error) {
    console.error("[checkout/reconcile] Failed:", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
