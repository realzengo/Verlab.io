import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Unlike Polar (which needed a customerSessions.create() API call per visit),
// Whop puts a directly-usable hosted management URL on the membership object
// itself -- the webhook handler stores the latest one on every membership.*
// event, so this route just reads it back instead of calling Whop.
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("whop_manage_url").eq("id", user.id).single();

  if (!profile?.whop_manage_url) {
    return NextResponse.json({ error: "No billing account yet" }, { status: 404 });
  }

  return NextResponse.json({ url: profile.whop_manage_url });
}
