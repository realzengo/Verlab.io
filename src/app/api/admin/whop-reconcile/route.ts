import { NextRequest, NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { reconcileWhopRange } from "@/lib/server/whop-reconcile-range";

// A full sweep makes a lot of sequential Whop calls; 300s is the ceiling
// this app's other long routes assume. If a window still times out, run it
// in narrower slices -- every handler underneath dedupes, so overlapping
// slices are safe.
export const maxDuration = 300;

/**
 * Replays Whop payments, refunds and membership state that POST
 * /api/webhooks/whop dropped while Supabase was unreachable. See
 * src/lib/server/whop-reconcile-range.ts for why those events are gone for
 * good and cannot simply be re-delivered.
 *
 * Body: { since, until?, dryRun?, includeMemberships? }
 *   since/until  ISO 8601. Bracket the outage generously -- overlap is free
 *                because every write dedupes on the upstream object's id.
 *   dryRun       default TRUE. This grants and claws back real credits and
 *                changes plans in bulk, so the destructive form has to be
 *                asked for explicitly.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { since?: string; until?: string; dryRun?: boolean; includeMemberships?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.since || typeof body.since !== "string") {
    return NextResponse.json({ error: "since is required (ISO 8601)" }, { status: 400 });
  }

  const since = new Date(body.since);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "since is not a valid date" }, { status: 400 });
  }

  const until = body.until ? new Date(body.until) : new Date();
  if (Number.isNaN(until.getTime())) {
    return NextResponse.json({ error: "until is not a valid date" }, { status: 400 });
  }

  if (until <= since) {
    return NextResponse.json({ error: "until must be after since" }, { status: 400 });
  }

  // Default-on, so omitting the flag reports instead of mutating.
  const dryRun = body.dryRun !== false;

  try {
    const result = await reconcileWhopRange({
      since: since.toISOString(),
      until: until.toISOString(),
      dryRun,
      includeMemberships: body.includeMemberships !== false,
    });

    console.log(`[admin/whop-reconcile] ${adminEmail} ${dryRun ? "dry-run" : "APPLIED"}`, JSON.stringify(result));
    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin/whop-reconcile] Failed:", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
