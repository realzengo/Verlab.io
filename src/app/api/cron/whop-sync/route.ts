import { NextRequest, NextResponse } from "next/server";
import { ensureWhopWebhookEnabled } from "@/lib/server/whop-sync";
import { reconcileWhopRange } from "@/lib/server/whop-reconcile-range";

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
      console.error(`[cron/whop-sync] Whop had disabled our webhook; re-enabled ${webhook.reenabled.join(", ")}`);
    }
  } catch (error) {
    webhook = { error: error instanceof Error ? error.message : String(error) };
    console.error("[cron/whop-sync] Webhook check failed:", error);
  }

  try {
    const until = new Date();
    const result = await reconcileWhopRange({
      since: new Date(until.getTime() - LOOKBACK_MS).toISOString(),
      until: until.toISOString(),
      dryRun: false,
      includeMemberships: true,
    });
    if (result.payments.granted > 0 || result.refunds.clawedBack > 0 || result.errors.length > 0) {
      console.error("[cron/whop-sync] Recovered events the webhook missed:", JSON.stringify(result));
    }
    return NextResponse.json({ webhook, ...result });
  } catch (error) {
    console.error("[cron/whop-sync] Reconcile failed:", error);
    return NextResponse.json({ webhook, error: "Reconcile failed" }, { status: 500 });
  }
}

export const POST = GET;
