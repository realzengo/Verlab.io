import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fixed-window counter backed by check_rate_limit (see
 * supabase/migrations/20260815120000_rate_limits.sql) -- records one hit
 * for bucketKey and returns whether that bucket is still under limit within
 * windowSeconds.
 */
export async function checkRateLimit(bucketKey: string, limit: number, windowSeconds: number): Promise<boolean> {
  const admin = createAdminClient();
  const { data: count, error } = await admin.rpc("check_rate_limit", {
    p_bucket_key: bucketKey,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Fail open -- a rate-limit outage shouldn't take the actual feature
    // down with it.
    console.error("[rate-limit] check failed, allowing request:", error);
    return true;
  }

  return (count ?? 0) <= limit;
}

export function rateLimitedResponse(): NextResponse {
  return NextResponse.json(
    { error: "You're generating too fast. Please wait a moment and try again." },
    { status: 429 }
  );
}
