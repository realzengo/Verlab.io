import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCreditPacks, getWhopClient, type CreditPackId } from "@/lib/config/whop";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { packId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const packs = getCreditPacks();
  const packId = body.packId as CreditPackId | undefined;
  if (!packId || !(packId in packs)) {
    return NextResponse.json({ error: "Invalid packId" }, { status: 400 });
  }

  const redirectUrl = process.env.WHOP_CHECKOUT_SUCCESS_URL;
  if (!redirectUrl) {
    return NextResponse.json({ error: "Checkout not configured" }, { status: 500 });
  }

  try {
    // metadata.user_id is copied onto the resulting payment by Whop -- the
    // webhook handler reads it back to know who to grant credits to.
    const checkout = await getWhopClient().checkoutConfigurations.create({
      plan_id: packs[packId].whopPlanId,
      metadata: { user_id: user.id },
      redirect_url: redirectUrl,
    });
    return NextResponse.json({ url: checkout.purchase_url });
  } catch (error) {
    console.error("[checkout/credits] Whop checkout creation failed:", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
