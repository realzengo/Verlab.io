import { createAdminClient } from "@/lib/supabase/admin";
import type { PromoRewardType } from "@/lib/types";

export class PromoCodeError extends Error {}

export interface PromoRedemption {
  rewardType: PromoRewardType;
  rewardValue: number;
}

/**
 * Validates a promo code and atomically increments its used_count via the
 * redeem_promo_code() Postgres function (see 20260725150000_promo_codes.sql,
 * extended by 20260816130000_promo_code_redemptions.sql) -- the lookup,
 * active/expiry/max-uses/already-redeemed-by-this-user checks, the
 * increment, and the per-user redemption record all happen in one
 * statement, so two concurrent redemptions (of a near-exhausted code, or by
 * the same user twice) can't both succeed. The RPC raises the exact
 * user-facing message this re-throws unchanged.
 */
export async function validateAndUsePromoCode(code: string, userId: string): Promise<PromoRedemption> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_promo_code", { p_code: code, p_user_id: userId }).single();

  if (error) {
    throw new PromoCodeError(error.message);
  }

  const row = data as { reward_type: string; reward_value: number };

  return {
    rewardType: row.reward_type as PromoRewardType,
    rewardValue: row.reward_value,
  };
}
