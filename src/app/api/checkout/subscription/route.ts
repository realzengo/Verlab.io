import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getSubscriptionProductId,
  getPolarClient,
  type SubscriptionPlanId,
  type BillingPeriod,
} from "@/lib/config/polar";

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
  if (planId === "core" && period === "yearly") {
    return NextResponse.json({ error: "Core does not support yearly billing" }, { status: 400 });
  }

  const successUrl = process.env.POLAR_CHECKOUT_SUCCESS_URL;
  if (!successUrl) {
    return NextResponse.json({ error: "Checkout not configured" }, { status: 500 });
  }

  try {
    const productId = getSubscriptionProductId(planId, period);
    const checkout = await getPolarClient().checkouts.create({
      products: [productId],
      externalCustomerId: user.id,
      customerEmail: user.email ?? undefined,
      successUrl,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("[checkout/subscription] Polar checkout creation failed:", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
