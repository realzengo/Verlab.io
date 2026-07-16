import { NextRequest, NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PricingPlan } from "@/lib/types";

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { plans?: PricingPlan[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.plans) || body.plans.length === 0) {
    return NextResponse.json({ error: "plans is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const rows = body.plans.map((plan, index) => ({
    id: plan.id,
    name: plan.name,
    info: plan.info,
    price_monthly: plan.price.monthly,
    price_yearly: plan.price.yearly,
    recommended: Boolean(plan.recommended),
    monthly_only: Boolean(plan.monthlyOnly),
    cta: plan.cta,
    features: plan.features,
    limits: plan.limits ?? null,
    sort_order: index,
  }));

  const { error } = await admin.from("plan_definitions").upsert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
