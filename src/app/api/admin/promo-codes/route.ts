import { NextRequest, NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { getPromoCodes, mapPromoCodeRow } from "@/lib/server/admin-queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";
import { isValidCode } from "@/lib/validation";
import type { PromoRewardType } from "@/lib/types";

const REWARD_TYPES: PromoRewardType[] = ["credits", "discount_percent"];

export async function GET(): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const codes = await getPromoCodes();
  return NextResponse.json({ codes });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    code?: string;
    rewardType?: string;
    rewardValue?: number;
    maxUses?: number | null;
    expiresAt?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { code, rewardType, rewardValue, maxUses, expiresAt } = body;

  if (!code || typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  if (!isValidCode(code)) {
    return NextResponse.json({ error: "code may only contain letters, numbers, dashes, and underscores" }, { status: 400 });
  }

  if (!rewardType || !REWARD_TYPES.includes(rewardType as PromoRewardType)) {
    return NextResponse.json({ error: "rewardType must be 'credits' or 'discount_percent'" }, { status: 400 });
  }

  if (!Number.isInteger(rewardValue) || rewardValue! <= 0) {
    return NextResponse.json({ error: "rewardValue must be a positive integer" }, { status: 400 });
  }

  if (maxUses != null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
    return NextResponse.json({ error: "maxUses must be a positive integer when provided" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("promo_codes")
    .insert({
      code: code.trim().toUpperCase(),
      reward_type: rewardType,
      reward_value: rewardValue,
      max_uses: maxUses ?? null,
      expires_at: expiresAt || null,
    })
    .select("id, code, reward_type, reward_value, max_uses, used_count, expires_at, is_active, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A promo code with that code already exists" }, { status: 409 });
    }
    return serverError("admin/promo-codes POST", error);
  }

  return NextResponse.json({ code: mapPromoCodeRow(data) });
}
