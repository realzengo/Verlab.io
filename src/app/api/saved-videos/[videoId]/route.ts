import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApiLogging } from "@/lib/server/api-logging";

async function routeDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
): Promise<NextResponse> {
  const { videoId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("saved_videos")
    .delete()
    .eq("user_id", user.id)
    .eq("video_id", videoId);

  if (error) {
    console.error("[saved-videos] unsave failed:", error.message);
    return NextResponse.json({ error: "Couldn't unsave video." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const DELETE = withApiLogging("/api/saved-videos/[videoId]", routeDELETE);
