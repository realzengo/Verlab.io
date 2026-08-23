import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";
import { PLAN_DEFINITIONS_CACHE_TAG } from "@/lib/server/admin-queries";
import { FREE_TEXT_MAX, NAME_MAX, SHORT_TEXT_MAX, isPlainTextSafe, isSafeFreeText } from "@/lib/validation";
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
    if (!isPlainTextSafe(plan.name, NAME_MAX)) {
      return NextResponse.json({ error: `Plan "${label}" name must be ${NAME_MAX} characters or fewer and contain no HTML or control characters` }, { status: 400 });
    }
    if (!isPlainTextSafe(plan.cta, NAME_MAX)) {
      return NextResponse.json({ error: `Plan "${label}" CTA must be ${NAME_MAX} characters or fewer and contain no HTML or control characters` }, { status: 400 });
    }
    if (!isSafeFreeText(plan.info, FREE_TEXT_MAX)) {
      return NextResponse.json({ error: `Plan "${label}" description must be ${FREE_TEXT_MAX} characters or fewer and contain no HTML or control characters` }, { status: 400 });
    }
    if (plan.limits && !isSafeFreeText(plan.limits, FREE_TEXT_MAX)) {
      return NextResponse.json({ error: `Plan "${label}" limits note must be ${FREE_TEXT_MAX} characters or fewer and contain no HTML or control characters` }, { status: 400 });
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
    const hasInvalidFeature = plan.features.some(
      (f) =>
        typeof f?.text !== "string" ||
        !isPlainTextSafe(f.text, SHORT_TEXT_MAX) ||
        (f.tooltip ? !isPlainTextSafe(f.tooltip, SHORT_TEXT_MAX) : false)
    );
    if (hasInvalidFeature) {
      return NextResponse.json(
        { error: `Plan "${label}" has a feature text or tooltip over ${SHORT_TEXT_MAX} characters or containing invalid characters` },
        { status: 400 }
      );
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

  // { expire: 0 } forces immediate expiration (vs the stale-while-revalidate
  // "max" profile) since an admin editing pricing expects the change to show
  // up on the very next pricing-section view, not after a background refresh.
  revalidateTag(PLAN_DEFINITIONS_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ ok: true });
}
