import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("transcripts")
    .select(
      "id, source_url, platform, status, title, cover_url, duration_seconds, video_url, embed_url, lines, error_message, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ transcript: data });
}

export const GET = withApiLogging("/api/transcripts/status/[id]", handleGET);
