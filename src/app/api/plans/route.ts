import { NextResponse } from "next/server";
import { getCachedPlanDefinitions } from "@/lib/server/admin-queries";

// Live price list for the in-app pricing UI (UpgradeModal, PaywallPricing,
// PlanTab). plan_definitions has no client RLS policy, so the browser can't
// read it directly -- this serves the same cached service-role read the
// landing page's PricingSection already renders for every visitor, so it
// exposes nothing that isn't public already.
export async function GET(): Promise<NextResponse> {
  const plans = await getCachedPlanDefinitions();
  return NextResponse.json({ plans });
}
