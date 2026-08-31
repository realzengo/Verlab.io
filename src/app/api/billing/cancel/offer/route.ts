import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRetentionOffer, isCancellationReason, NoActiveSubscriptionError } from "@/lib/server/cancellation";

/**
 * Accepts the retention offer shown mid-way through the cancellation flow
 * ("More time to decide" -> 7 free days). Does not cancel anything -- see
 * POST /api/billing/cancel for that.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { reason?: string; reasonDetail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isCancellationReason(body.reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }

  try {
    const result = await applyRetentionOffer(user.id, body.reason, body.reasonDetail);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NoActiveSubscriptionError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[billing/cancel/offer] Failed:", error);
    return NextResponse.json({ error: "Could not extend your subscription. Please try again." }, { status: 500 });
  }
}
