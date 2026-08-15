import { NextRequest, NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";

export async function GET(): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feature_flags")
    .select("id, label, description, enabled, rollout_pct")
    .order("id");

  if (error) {
    return serverError("admin/feature-flags GET", error);
  }

  return NextResponse.json({ flags: data });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: string; enabled?: boolean; rolloutPct?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "id and enabled are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("feature_flags")
    .update({
      enabled: body.enabled,
      rollout_pct: body.rolloutPct ?? (body.enabled ? 100 : 0),
      updated_by: adminEmail,
    })
    .eq("id", body.id);

  if (error) {
    return serverError("admin/feature-flags PATCH", error);
  }

  return NextResponse.json({ ok: true });
}
