import { NextRequest, NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";
import { NAME_MAX, isValidEmail, isValidName } from "@/lib/validation";
import type { AdminRole } from "@/lib/types";

const VALID_ROLES: AdminRole[] = ["owner", "admin", "support"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: string; email?: string; role?: AdminRole };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = body.role;

  if (!name || !email || !role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "name, email, and a valid role are required" }, { status: 400 });
  }

  if (!isValidName(name, NAME_MAX)) {
    return NextResponse.json({ error: "name contains invalid characters or is too long" }, { status: 400 });
  }

  // The client sends a type=email input, but that's a UI hint only -- a direct API call can
  // bypass it entirely, so the format must be enforced here too, not just via the DB's
  // unique-constraint check below.
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "email must be a valid email address" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_team")
    .insert({ name, email, role })
    .select("id, name, email, role, last_login_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That email is already on the admin team" }, { status: 409 });
    }
    return serverError("admin/team POST", error);
  }

  return NextResponse.json({
    member: {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      lastLogin: data.last_login_at ?? new Date(0).toISOString(),
    },
  });
}
