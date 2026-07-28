import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPolarClient } from "@/lib/config/polar";

export async function POST(_request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("polar_customer_id").eq("id", user.id).single();

  if (!profile?.polar_customer_id) {
    return NextResponse.json({ error: "No billing account yet" }, { status: 404 });
  }

  try {
    const session = await getPolarClient().customerSessions.create({ externalCustomerId: user.id });
    return NextResponse.json({ url: session.customerPortalUrl });
  } catch (error) {
    console.error("[billing/portal] Polar customer session creation failed:", error);
    return NextResponse.json({ error: "Could not open billing portal" }, { status: 500 });
  }
}
