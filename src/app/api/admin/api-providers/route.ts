import { NextRequest, NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";
import { NAME_MAX, SHORT_TEXT_MAX, isPlainTextSafe, isValidName, isValidUrl } from "@/lib/validation";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    name?: string;
    category?: string;
    envVar?: string | null;
    websiteUrl?: string | null;
    notes?: string | null;
    monthlyCost?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.category?.trim()) {
    return NextResponse.json({ error: "Name and category are required" }, { status: 400 });
  }
  if (!isValidName(body.name, NAME_MAX)) {
    return NextResponse.json({ error: "Name contains invalid characters or is too long" }, { status: 400 });
  }
  if (!isValidName(body.category, NAME_MAX)) {
    return NextResponse.json({ error: "Category contains invalid characters or is too long" }, { status: 400 });
  }
  if (body.envVar?.trim() && !isPlainTextSafe(body.envVar.trim(), SHORT_TEXT_MAX)) {
    return NextResponse.json({ error: "Env var contains invalid characters or is too long" }, { status: 400 });
  }
  if (body.websiteUrl?.trim() && !isValidUrl(body.websiteUrl.trim())) {
    return NextResponse.json({ error: "Website must be a valid http(s) URL" }, { status: 400 });
  }
  if (body.monthlyCost != null && (!Number.isFinite(body.monthlyCost) || body.monthlyCost < 0)) {
    return NextResponse.json({ error: "Monthly cost must be a non-negative number" }, { status: 400 });
  }

  const id = body.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const admin = createAdminClient();
  const { count } = await admin.from("api_providers").select("id", { count: "exact", head: true });

  const { data, error } = await admin
    .from("api_providers")
    .insert({
      id,
      name: body.name.trim(),
      category: body.category.trim(),
      env_var: body.envVar?.trim() || null,
      website_url: body.websiteUrl?.trim() || null,
      notes: body.notes?.trim() || null,
      monthly_cost: body.monthlyCost ?? 0,
      sort_order: count ?? 0,
    })
    .select("id, name, category, env_var, website_url, notes, monthly_cost, currency, is_active, updated_at")
    .single();

  if (error) {
    return serverError("admin/api-providers POST", error);
  }

  return NextResponse.json({
    provider: {
      id: data.id,
      name: data.name,
      category: data.category,
      envVar: data.env_var,
      websiteUrl: data.website_url,
      notes: data.notes,
      monthlyCost: data.monthly_cost,
      currency: data.currency,
      isActive: data.is_active,
      configured: data.env_var ? !!process.env[data.env_var] : false,
      updatedAt: data.updated_at,
    },
  });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: string; monthlyCost?: number; notes?: string | null; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (body.monthlyCost != null && (!Number.isFinite(body.monthlyCost) || body.monthlyCost < 0)) {
    return NextResponse.json({ error: "Monthly cost must be a non-negative number" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.monthlyCost != null) update.monthly_cost = body.monthlyCost;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.isActive !== undefined) update.is_active = body.isActive;

  const admin = createAdminClient();
  const { error } = await admin.from("api_providers").update(update).eq("id", body.id);

  if (error) {
    return serverError("admin/api-providers PATCH", error);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("api_providers").delete().eq("id", id);

  if (error) {
    return serverError("admin/api-providers DELETE", error);
  }

  return NextResponse.json({ ok: true });
}
