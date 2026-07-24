import { createAdminClient } from "@/lib/supabase/admin";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Reads the current credit balance. Uses the service-role client (same
 * rationale as usage.ts) so this can be called from trusted server code
 * without depending on the caller's own Supabase session.
 */
export async function getUserCredits(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("credits").eq("id", userId).single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not load credit balance");
  }

  return data.credits;
}

/**
 * Deducts `amount` credits and logs a credit_transactions row, atomically,
 * via the deduct_credits() Postgres function (see
 * 20260722120001_credits_system.sql) — the balance check, decrement, and
 * ledger insert all happen in one statement so concurrent calls can't drive
 * the balance negative. Throws InsufficientCreditsError if the balance is
 * too low; the caller (an API route) should turn that into a 403.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  feature: string,
  actionKey?: string
): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("amount must be a positive integer");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_feature: feature,
    p_action_key: actionKey ?? null,
  });

  if (error) {
    if (error.message.includes("Insufficient credits")) {
      throw new InsufficientCreditsError();
    }
    throw new Error(error.message);
  }

  return data as number;
}

export interface ChargeResult {
  /** Credits actually charged. 0 means no DB call was made at all. */
  charged: number;
  /** New balance after the charge, or null when charged === 0. */
  newBalance: number | null;
}

/**
 * Higher-level charge primitive. The caller resolves `amount` from
 * src/lib/config/pricing.ts (a flat TOOL_CREDIT_COSTS lookup, or
 * getImageGenerationCost(...) for image generation) -- pricing.ts stays the
 * single source of truth for "how much does X cost", this file stays the
 * single source of truth for "how do we move credits".
 *
 * If amount is 0 (WASM video compression, or any future free action), this
 * returns immediately with NO database call, per the requirement that free
 * actions never touch Postgres.
 *
 * Propagates InsufficientCreditsError unchanged -- callers should catch it
 * and return a 402/403.
 */
export async function chargeUser(
  userId: string,
  amount: number,
  feature: string,
  actionKey: string
): Promise<ChargeResult> {
  if (amount === 0) {
    return { charged: 0, newBalance: null };
  }
  const newBalance = await deductCredits(userId, amount, feature, actionKey);
  return { charged: amount, newBalance };
}

/**
 * Best-effort refund for charge-before-call routes -- used when the charge
 * succeeded but the underlying third-party call then failed outright (no
 * partial output, no value delivered). Never throws into the caller's
 * failure-handling path; a refund failure is logged only, same resilience
 * posture as the rest of this file's credit error handling.
 */
/**
 * Admin-only manual adjustment -- grants (positive delta) or removes
 * (negative delta) credits from a user's balance via the
 * admin_adjust_credits() RPC (see 20260724120000_credit_admin_grants.sql),
 * logging both the reason and the acting admin's email for an audit trail.
 * Removals are floor-checked the same way deductCredits() is; throws
 * InsufficientCreditsError if a negative delta would take the balance below
 * zero. Callers must have already verified the caller is an admin (e.g. via
 * getAdminEmailOrNull()) -- this function does not check that itself.
 */
export async function adjustCreditsAsAdmin(
  userId: string,
  delta: number,
  reason: string,
  adminEmail: string
): Promise<number> {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error("delta must be a non-zero integer");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_adjust_credits", {
    p_admin_email: adminEmail,
    p_user_id: userId,
    p_delta: delta,
    p_reason: reason,
  });

  if (error) {
    if (error.message.includes("Insufficient credits")) {
      throw new InsufficientCreditsError();
    }
    throw new Error(error.message);
  }

  return data as number;
}

export async function refundUser(userId: string, amount: number, feature: string, actionKey: string): Promise<void> {
  if (amount <= 0) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("refund_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_feature: feature,
      p_action_key: actionKey,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[credits] Failed to refund credits:", error);
  }
}
