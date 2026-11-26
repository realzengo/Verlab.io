import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitCancellation, isCancellationReason, NoActiveSubscriptionError } from "@/lib/server/cancellation";
import type { CancellationReason } from "@/lib/cancellation";

/**
 * Finalizes an in-app cancellation (Settings > Subscription > Cancel
 * subscription > "Yes, cancel subscription"). Schedules the membership to
 * cancel at the end of the current billing period -- access is kept through
 * the period already paid for, and no further payment is taken.
 *
 * A reason is optional: cancelling must never depend on answering a survey.
 * An unanswered survey is stored as "other" with a "Not given" detail,
 * since cancellation_feedback.reason is NOT NULL.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { reason?: string; reasonDetail?: string; additionalFeedback?: string; offerShown?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // An empty body is fine -- every field is optional.
  }

  if (body.reason !== undefined && body.reason !== null && body.reason !== "" && !isCancellationReason(body.reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }
  const reason: CancellationReason | null = isCancellationReason(body.reason) ? body.reason : null;

  try {
    const result = await submitCancellation(user.id, {
      reason: reason ?? "other",
      reasonDetail: reason ? body.reasonDetail : "Not given",
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
