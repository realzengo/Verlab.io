import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";

async function handleGET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("scripts")
    .select("id, prompt, content, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scripts: data });
}

export const GET = withApiLogging("/api/scripts", handleGET);
