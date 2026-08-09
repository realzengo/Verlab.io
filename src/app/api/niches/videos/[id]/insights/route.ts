import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeVideoOutlierInsights } from "@/lib/server/video-outlier";
import { withApiLogging } from "@/lib/server/api-logging";

async function routeGET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const insights = await computeVideoOutlierInsights(admin, id);
    if (!insights) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json(insights);
  } catch (err) {
    console.error("[niches/videos/insights] unhandled error:", err);
    return NextResponse.json({ error: "Something went wrong loading video insights." }, { status: 500 });
  }
}

export const GET = withApiLogging("/api/niches/videos/[id]/insights", routeGET);
