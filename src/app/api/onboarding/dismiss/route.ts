import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/server/api-error";

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_dismissed_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return serverError("onboarding/dismiss POST", error, "Could not dismiss checklist");
  }

  return NextResponse.json({ ok: true });
}
