import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Same rationale as niches/refresh and trending-videos/refresh -- Vercel
// Cron requests carry x-vercel-cron automatically; the bearer fallback lets
// this be triggered manually (local testing, a different scheduler).
function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron")) return true;

  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

// whop_webhook_events.payload embeds customer PII (name, email, billing
// metadata) inside Whop's raw webhook JSON. The admin revenue dashboard
// (getRevenueData in src/lib/server/admin-queries.ts) only ever reads the
// last ~30 days of these for MRR/churn series and the last 20 transactions,
// so nothing live depends on payload surviving past that. RETENTION_DAYS is
// set well beyond that -- long enough to cover a full fiscal year of
// accounting reconciliation plus card-network chargeback windows (typically
// <=180 days) -- short of "forever."
//
// Only the payload is scrubbed; id/type/created_at/processed_at are left
// alone, so webhook delivery dedup (ON CONFLICT (id) DO NOTHING in
// /api/webhooks/whop) and the historical event timeline keep working
// unchanged. parseRevenueTransaction already treats a payload with no
// `.data` as "skip this row" (returns null), so a redacted row quietly
// drops out of analytics instead of crashing anything if it's ever queried.
const RETENTION_DAYS = 400;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("whop_webhook_events")
    .update({ payload: { redacted: true }, payload_redacted_at: new Date().toISOString() })
    .lt("created_at", cutoff)
    .is("payload_redacted_at", null)
    .select("id");

  if (error) {
    console.error("[redact-webhook-payloads] Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ redacted: data?.length ?? 0 });
}
