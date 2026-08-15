import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/server/api-error";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase.from("profiles").select("credits").eq("id", user.id).single();

  if (error || !data) {
    return serverError("credits GET", error, "Could not load credits");
  }

  return NextResponse.json({ credits: data.credits });
}
