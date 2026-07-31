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

// Retention window for both instrumentation tables -- bounds their growth
// without a separate prune cron, since this one already runs every 5 min.
const RETENTION_DAYS = 35;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const start = Date.now();

  let ok: boolean;
  let error: string | null = null;
  try {
    // A cheap, real DB round-trip -- this is what "up" means here (no
    // external monitor exists in this stack, see the migration comment).
    const { error: queryError } = await admin.from("profiles").select("id").limit(1);
    if (queryError) throw new Error(queryError.message);
    ok = true;
  } catch (err) {
    ok = false;
    error = err instanceof Error ? err.message : "Health check query failed";
  }

  const latencyMs = Date.now() - start;
  await admin.from("health_checks").insert({ ok, latency_ms: latencyMs, error });

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await Promise.all([
    admin.from("health_checks").delete().lt("created_at", cutoff),
    admin.from("api_request_log").delete().lt("created_at", cutoff),
  ]);

  return NextResponse.json({ ok, latencyMs });
}
