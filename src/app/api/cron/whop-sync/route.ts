import { NextRequest, NextResponse } from "next/server";
import { ensureWhopWebhookEnabled } from "@/lib/server/whop-sync";
import { reconcileWhopRange } from "@/lib/server/whop-reconcile-range";
import { reportBillingError } from "@/lib/server/billing-alerts";

export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron")) return true;
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

/** Overlapping windows are free: every write dedupes on Whop's own ids. */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The safety net under POST /api/webhooks/whop. Webhooks alone lost every
 * payment from August to November 2026: Whop disabled the endpoint after an
 * outage and nothing told us. Every 10 minutes this
 *   1. turns our Whop webhook back on if Whop has switched it off, and
 *   2. replays the last 3 days of paid payments and refunds, and the current
 *      state of every membership, through the webhook's own handlers,
 * so a payment that never arrives as a webhook still grants its credits and
 * shows on the admin within minutes.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let webhook: Awaited<ReturnType<typeof ensureWhopWebhookEnabled>> | { error: string };
  try {
    webhook = await ensureWhopWebhookEnabled();
    if (webhook.reenabled.length > 0) {
      // Whop only disables an endpoint after days of failed deliveries, so
      // this means the webhook has been broken that long.
      await reportBillingError({
        source: "whop_sync_cron",
        stage: "webhook_disabled",
        error: new Error(`Whop had disabled our webhook; re-enabled ${webhook.reenabled.join(", ")}`),
      });
    }
  } catch (error) {
    webhook = { error: error instanceof Error ? error.message : String(error) };
    await reportBillingError({ source: "whop_sync_cron", stage: "webhook_check", error });
  }

  try {
    const until = new Date();
    const result = await reconcileWhopRange({
      since: new Date(until.getTime() - LOOKBACK_MS).toISOString(),
      until: until.toISOString(),
      dryRun: false,
      includeMemberships: true,
    });
    if (result.payments.granted > 0 || result.refunds.clawedBack > 0) {
      console.error("[cron/whop-sync] Recovered events the webhook missed:", JSON.stringify(result));
    }
    // One alert per failed object: each carries the Whop id in its message
    // ("payment pay_...: <error>"), so PostHog groups repeats of the same one
    // into one issue. Capped so a sweep where everything fails can't spend
    // the run on reporting.
    for (const message of result.errors.slice(0, 20)) {
      await reportBillingError({
        source: "whop_sync_cron",
        stage: "reconcile_item",
        error: new Error(message),
        objectId: message.match(/\b(?:pay|mem|rfnd|ref)_[A-Za-z0-9]+/)?.[0] ?? null,
      });
    }
    return NextResponse.json({ webhook, ...result });
  } catch (error) {
    await reportBillingError({ source: "whop_sync_cron", stage: "reconcile", error });
    return NextResponse.json({ webhook, error: "Reconcile failed" }, { status: 500 });
  }
}

export const POST = GET;
