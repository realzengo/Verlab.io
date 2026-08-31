// Shared cancellation-flow constants used by both the client-side modal
// (CancelSubscriptionModal) and the server routes/helpers under
// src/lib/server/cancellation.ts. Keeping this out of lib/server means the
// client bundle never pulls in the Whop SDK or the admin Supabase client.

export const CANCELLATION_REASONS = [
  { id: "switching", label: "Moving to another tool" },
  { id: "too_expensive", label: "Too expensive" },
  { id: "missing_features", label: "Missing features I need" },
  { id: "technical_issues", label: "Running into bugs or technical issues" },
  { id: "bad_experience", label: "Just not a good experience" },
  { id: "other", label: "Other" },
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number]["id"];

const REASON_IDS = new Set<string>(CANCELLATION_REASONS.map((r) => r.id));

export function isCancellationReason(value: unknown): value is CancellationReason {
  return typeof value === "string" && REASON_IDS.has(value);
}

export const RETENTION_OFFER_FREE_DAYS = 7;
