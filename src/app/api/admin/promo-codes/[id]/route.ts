import { NextRequest, NextResponse } from "next/server";
import { getAdminEmailOrNull } from "@/lib/server/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverError } from "@/lib/server/api-error";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const adminEmail = await getAdminEmailOrNull();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("promo_codes").delete().eq("id", id);

  if (error) {
    return serverError("admin/promo-codes/[id] DELETE", error);
  }

  return NextResponse.json({ ok: true });
}
