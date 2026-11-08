import "server-only";
import { after } from "next/server";
import type { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { chargeUser, getUserCredits, InsufficientCreditsError } from "@/lib/server/credits";
import { APP_LINKS } from "../links";

// Every tool is scoped to a single Verlab user (`userId`, resolved from the
// connector's OAuth access token -- see src/app/api/mcp/route.ts). There is
// no cookie session on this path, so all DB access goes through the
// service-role client, and every query filters on user_id itself.
//
// Credit costs are never re-derived here -- always imported from
// src/lib/config/pricing.ts and applied via src/lib/server/credits.ts, the
// same primitives the web routes use, so MCP and web charges can't drift.
//
// Results follow the MCP Apps split: `content` (text) is what the model
// reads, `structuredContent` is what the widget renders and is never added to
// the model's context. So the text is a short, readable summary with the ids
// and links the model needs for a follow-up call -- never a JSON dump of the
// widget payload (images used to go into the model as multi-megabyte base64).

export type McpErrorCode = "insufficient_credits" | "plan_required" | "invalid_input" | "not_found" | "failed";

export function appResult(text: string, structuredContent: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], structuredContent };
}

/**
 * Error results carry structuredContent too (the SDK skips output-schema
 * validation when isError is set), so the widget can show a proper error
 * state -- with a top-up or upgrade button where one helps -- instead of
 * sitting on its loading placeholder forever.
 */
export function errorResult(message: string, code: McpErrorCode = "failed", extra: Record<string, unknown> = {}) {
  return {
    content: [{ type: "text" as const, text: message }],
    structuredContent: { error: { message, code, ...extra } },
    isError: true as const,
  };
}

export type McpToolResult = ReturnType<typeof appResult> | ReturnType<typeof errorResult>;

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  annotations: ToolAnnotations;
  handler: (userId: string, args: Record<string, unknown>) => Promise<McpToolResult>;
}

// Read-only tools can be auto-approved by hosts that honor the hint, so
// browsing a library or checking a job never interrupts the user.
export const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
// Status checks read the user's own job and may nudge it forward (polling the
// provider), but never create, charge or delete anything.
export const STATUS_CHECK: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
// Anything that spends credits or calls an outside service on the user's behalf.
export const CREATES: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };

export async function insufficientCredits(userId: string, cost: number) {
  const balance = await getUserCredits(userId).catch(() => null);
  const have = balance === null ? "" : ` The account has ${balance.toLocaleString()}.`;
  return errorResult(
    `Not enough Verlab credits: this needs ${cost.toLocaleString()}.${have} The user can top up at ${APP_LINKS.credits} and try again.`,
    "insufficient_credits",
    { needed: cost, balance, actionUrl: APP_LINKS.credits }
  );
}

/** Balance pre-check for tools that charge only once the work succeeds. Null means OK. */
export async function requireCredits(userId: string, cost: number) {
  const balance = await getUserCredits(userId);
  return balance < cost ? insufficientCredits(userId, cost) : null;
}

/** Charges before the work starts (the tool refunds on failure). Null means charged. */
export async function chargeUpfront(userId: string, cost: number, feature: string, actionKey: string) {
  try {
    await chargeUser(userId, cost, feature, actionKey);
    return null;
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCredits(userId, cost);
    throw error;
  }
}

// How long a tool call waits for an async job before handing back a
// "still working" result that the widget keeps polling. Hosts enforce their
// own per-call timeouts, so results come back as soon as they're ready
// rather than always holding the connection for the full budget.
export const ASYNC_TOOL_BUDGET_MS = 50_000;

export type JobOutcome<T> = { state: "done"; value: T } | { state: "failed"; error: unknown } | { state: "running" };

/**
 * Runs an async job against the call's time budget.
 *
 * - The failure handler is attached before anything can reject, so a job
 *   that fails inside the budget still marks its row failed and refunds
 *   (previously such a rejection escaped the handler and left the row stuck
 *   in "processing" with the credits gone).
 * - The settled promise is registered with after(), so a job that outlives
 *   the budget keeps running after the tool result is sent instead of being
 *   frozen with the serverless function (the route allows 300s in total).
 */
export async function runJob<T>(
  work: () => Promise<T>,
  onFailure: (error: unknown) => Promise<void>,
  budgetMs = ASYNC_TOOL_BUDGET_MS
): Promise<JobOutcome<T>> {
  const settled: Promise<JobOutcome<T>> = Promise.resolve()
    .then(work)
    .then(
      (value) => ({ state: "done" as const, value }),
      async (error: unknown) => {
        try {
          await onFailure(error);
        } catch (cleanupError) {
          console.error("[mcp] job cleanup failed:", cleanupError);
        }
        return { state: "failed" as const, error };
      }
    );

  after(() => settled.then(() => undefined));

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<JobOutcome<T>>((resolve) => {
    timer = setTimeout(() => resolve({ state: "running" }), budgetMs);
  });
  const outcome = await Promise.race([settled, timeout]);
  clearTimeout(timer);
  return outcome;
}

/** Shared note for "still working" results: the widget polls on its own, so the model shouldn't. */
export const POLLING_NOTE =
  "The card above updates by itself when it's done. Don't call the status tool again unless the user asks for an update.";

export function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

export function optionalStringArg(args: Record<string, unknown>, key: string): string | undefined {
  return stringArg(args, key) || undefined;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Caps text sent to the model, with an honest marker when it was cut. */
export function capText(text: string, max: number, cutNote: string): string {
  return text.length > max ? `${text.slice(0, max)}\n\n[${cutNote}]` : text;
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0:00";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
