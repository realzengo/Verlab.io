import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";

async function handleGET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("transcripts")
    .select(
      "id, source_url, platform, status, title, cover_url, duration_seconds, video_url, embed_url, lines, error_message, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return serverError("transcripts GET", error);
  }

  return NextResponse.json({ transcripts: data });
}

async function handleDELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be a non-empty array of strings" }, { status: 400 });
  }

  const { error } = await supabase.from("transcripts").delete().in("id", ids);

  if (error) {
    return serverError("transcripts DELETE", error);
  }

  return NextResponse.json({ success: true });
}

export const GET = withApiLogging("/api/transcripts", handleGET);
export const DELETE = withApiLogging("/api/transcripts", handleDELETE);
