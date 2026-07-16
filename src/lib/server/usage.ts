import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminToolKey } from "@/lib/types";

/**
 * Records one row of tool usage — the single source of truth behind the
 * admin dashboard's usage series, tool-usage share, and per-user usage
 * stats. Uses the service-role client since usage_events has no client
 * insert grant (users shouldn't be able to fake their own usage). Never
 * throws — a logging failure shouldn't break the calling request.
 */
export async function recordUsageEvent(
  tool: AdminToolKey,
  userId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("usage_events").insert({ user_id: userId, tool, metadata });
  } catch (error) {
    console.error(`[usage] Failed to record ${tool} usage event:`, error);
  }
}

/**
 * Appends an admin-visible activity log entry. Same service-role rationale
 * as recordUsageEvent. Never throws.
 */
export async function logActivity(input: {
  type: "billing" | "user" | "system" | "content";
  message: string;
  actor: string;
  userId?: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("activity_log").insert({
      type: input.type,
      message: input.message,
      actor: input.actor,
      user_id: input.userId ?? null,
    });
  } catch (error) {
    console.error("[activity] Failed to log activity:", error);
  }
}
