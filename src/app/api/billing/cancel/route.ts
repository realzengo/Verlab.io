import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitCancellation, isCancellationReason, NoActiveSubscriptionError } from "@/lib/server/cancellation";

/**
 * Finalizes an in-app cancellation (Settings > Subscription > Cancel
 * subscription) after the exit-survey flow. Schedules the Whop membership
 * to cancel at the end of the current billing period -- access is kept
 * through the period already paid for, same as canceling from Whop's own
 * hosted portal.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { reason?: string; reasonDetail?: string; additionalFeedback?: string; offerShown?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isCancellationReason(body.reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }

  try {
    const result = await submitCancellation(user.id, {
      reason: body.reason,
      reasonDetail: body.reasonDetail,
      additionalFeedback: body.additionalFeedback,
      offerShown: body.offerShown === true,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NoActiveSubscriptionError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[billing/cancel] Failed:", error);
    return NextResponse.json({ error: "Could not cancel your subscription. Please try again." }, { status: 500 });
  }
}
