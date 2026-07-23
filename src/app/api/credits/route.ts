import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.json({ error: error?.message ?? "Could not load credits" }, { status: 500 });
  }

  return NextResponse.json({ credits: data.credits });
}
