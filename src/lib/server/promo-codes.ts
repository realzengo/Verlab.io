import { createAdminClient } from "@/lib/supabase/admin";
import type { PromoRewardType } from "@/lib/types";

export class PromoCodeError extends Error {}

export interface PromoRedemption {
  rewardType: PromoRewardType;
  rewardValue: number;
}

/**
 * Validates a promo code and atomically increments its used_count via the
 * redeem_promo_code() Postgres function (see
 * 20260725150000_promo_codes.sql) -- the lookup, active/expiry/max-uses
 * checks, and increment all happen in one statement so two concurrent
 * redemptions of a near-exhausted code can't both succeed. The RPC raises
 * the exact user-facing message this re-throws unchanged.
 *
 * userId isn't used by the SQL function (there's no per-user redemption
 * ledger) but stays in the signature since the caller needs it to apply the
 * returned reward to that user's account/checkout afterward.
 */
export async function validateAndUsePromoCode(code: string, userId: string): Promise<PromoRedemption> {
  void userId;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_promo_code", { p_code: code }).single();

  if (error) {
    throw new PromoCodeError(error.message);
  }

  const row = data as { reward_type: string; reward_value: number };

  return {
    rewardType: row.reward_type as PromoRewardType,
    rewardValue: row.reward_value,
  };
}
