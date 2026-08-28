import { createAdminClient } from "@/lib/supabase/admin";
import { capturePostHogEvent } from "@/lib/server/posthog";
import type { AdminToolKey } from "@/lib/types";

/**
 * Records one row of tool usage — the single source of truth behind the
 * admin dashboard's usage series, tool-usage share, and per-user usage
 * stats. Uses the service-role client since usage_events has no client
 * insert grant (users shouldn't be able to fake their own usage). Never
 * throws — a logging failure shouldn't break the calling request.
 *
 * Also mirrors every call to PostHog as a "tool_used" event -- every tool
 * run in the product (bend, transcripts, image, video, voiceover,
 * downloader, mcp) already funnels through here, so this is the one place
 * that needs to know about product analytics rather than sprinkling
 * capture() calls across each tool's route handler.
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

  await capturePostHogEvent({ distinctId: userId, event: "tool_used", properties: { tool, ...metadata } });
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
