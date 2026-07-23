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
export async function deductCredits(userId: string, amount: number, feature: string): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("amount must be a positive integer");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_feature: feature,
  });

  if (error) {
    if (error.message.includes("Insufficient credits")) {
      throw new InsufficientCreditsError();
    }
    throw new Error(error.message);
  }

  return data as number;
}
