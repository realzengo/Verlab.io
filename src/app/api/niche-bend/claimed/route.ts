import { NextRequest, NextResponse } from "next/server";
import { listClaimedNiches } from "@/lib/server/niche-bend-claims";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 24;

  const items = await listClaimedNiches(supabase, user.id, limit);
  return NextResponse.json({ items });
}
