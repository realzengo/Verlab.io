import { NextResponse } from "next/server";
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
    .from("downloads")
    .select("id, source_url, platform, format, status, title, file_path, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return serverError("downloads GET", error);
  }

  return NextResponse.json({ downloads: data });
}

export const GET = withApiLogging("/api/downloads", handleGET);
