import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { grantCredits } from "@/lib/server/credits";
import { PromoCodeError, validateAndUsePromoCode } from "@/lib/server/promo-codes";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.code || typeof body.code !== "string" || !body.code.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  try {
    const redemption = await validateAndUsePromoCode(body.code.trim(), user.id);

    if (redemption.rewardType === "credits") {
      const balance = await grantCredits(user.id, redemption.rewardValue, "Promo code redemption", "promo.redeem");
      return NextResponse.json({ rewardType: redemption.rewardType, rewardValue: redemption.rewardValue, balance });
    }

    return NextResponse.json({ rewardType: redemption.rewardType, rewardValue: redemption.rewardValue });
  } catch (error) {
    if (error instanceof PromoCodeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Could not redeem promo code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
