import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Polled by /checkout/success while it waits for the Polar webhook to land.
 * Reads only the caller's own profile row (RLS-scoped via the user's own
 * session, not the service-role client) -- no Polar API call, no writes, so
 * there's nothing here that could double-grant credits or leak another
 * user's billing state.
 */
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("credits, plan, subscription_status")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
  }

  return NextResponse.json(profile);
}
