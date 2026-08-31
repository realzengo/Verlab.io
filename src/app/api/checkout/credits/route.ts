import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCreditPacks, getWhopClient, type CreditPackId } from "@/lib/config/whop";
import { capturePostHogEvent } from "@/lib/server/posthog";
import { hasActiveSubscription } from "@/lib/server/subscription";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Top-ups are extra credits on top of a plan, not a standalone purchase --
  // someone with no subscription (or a fully lapsed one) has no plan for
  // extra credits to sit on top of, so send them to subscribe first instead
  // of letting them buy a pack that has nothing to attach to.
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_current_period_end")
    .eq("id", user.id)
    .single();

  if (!hasActiveSubscription(profile)) {
    return NextResponse.json({ error: "An active subscription is required to top up credits.", code: "no_active_subscription" }, { status: 403 });
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
    after(() => capturePostHogEvent({ distinctId: user.id, event: "checkout_started", properties: { kind: "credits", packId } }));
    return NextResponse.json({ url: checkout.purchase_url });
  } catch (error) {
    console.error("[checkout/credits] Whop checkout creation failed:", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
