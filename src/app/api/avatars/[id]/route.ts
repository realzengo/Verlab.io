import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { USER_AVATAR_BUCKET, isUuid } from "@/lib/server/user-avatars";

async function handleDELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("user_avatars")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("image_path")
    .maybeSingle();

  if (error) {
    return serverError("avatars/[id] DELETE", error);
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Best-effort, like every other Storage cleanup here: the row is already
  // gone, so a failed removal is logged rather than reported.
  const { error: removeError } = await createAdminClient().storage.from(USER_AVATAR_BUCKET).remove([data.image_path]);
  if (removeError) {
    console.error("[avatars/[id] DELETE] storage cleanup failed:", removeError);
  }

  return NextResponse.json({ ok: true });
}

export const DELETE = withApiLogging("/api/avatars/[id]", handleDELETE);
