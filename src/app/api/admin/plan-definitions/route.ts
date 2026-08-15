import { NextRequest, NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";
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

  for (const plan of body.plans) {
    const label = plan?.id ?? "unknown";
    if (!plan?.id || !plan.name?.trim() || !plan.cta?.trim() || !plan.info?.trim()) {
      return NextResponse.json({ error: `Plan "${label}" is missing a required field (name, CTA, or description)` }, { status: 400 });
    }
    if (typeof plan.price?.monthly !== "number" || !Number.isFinite(plan.price.monthly) || plan.price.monthly < 0) {
      return NextResponse.json({ error: `Plan "${label}" has an invalid monthly price` }, { status: 400 });
    }
    if (!plan.monthlyOnly && (typeof plan.price?.yearly !== "number" || !Number.isFinite(plan.price.yearly) || plan.price.yearly < 0)) {
      return NextResponse.json({ error: `Plan "${label}" has an invalid yearly price` }, { status: 400 });
    }
    if (!Array.isArray(plan.features)) {
      return NextResponse.json({ error: `Plan "${label}" has invalid features` }, { status: 400 });
    }
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
    return serverError("admin/plan-definitions", error);
  }

  return NextResponse.json({ ok: true });
}
