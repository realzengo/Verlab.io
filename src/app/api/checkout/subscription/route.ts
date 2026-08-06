import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getSubscriptionPlanId,
  getWhopClient,
  type SubscriptionPlanId,
  type BillingPeriod,
} from "@/lib/config/whop";

const PLAN_IDS: SubscriptionPlanId[] = ["core", "pro", "scale"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { planId?: string; period?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const planId = body.planId as SubscriptionPlanId | undefined;
  const period = body.period as BillingPeriod | undefined;

  if (!planId || !PLAN_IDS.includes(planId)) {
    return NextResponse.json({ error: "Invalid planId" }, { status: 400 });
  }
  if (period !== "monthly" && period !== "yearly") {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const redirectUrl = process.env.WHOP_CHECKOUT_SUCCESS_URL;
  if (!redirectUrl) {
    return NextResponse.json({ error: "Checkout not configured" }, { status: 500 });
  }

  try {
    const whopPlanId = getSubscriptionPlanId(planId, period);
    // metadata.user_id is copied onto the resulting payment/membership by
    // Whop -- the webhook handler reads it back to know who this is for.
    const checkout = await getWhopClient().checkoutConfigurations.create({
      plan_id: whopPlanId,
      metadata: { user_id: user.id },
      redirect_url: redirectUrl,
    });
    return NextResponse.json({ url: checkout.purchase_url });
  } catch (error) {
    console.error("[checkout/subscription] Whop checkout creation failed:", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
