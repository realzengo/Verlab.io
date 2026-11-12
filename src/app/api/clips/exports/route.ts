import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import {
  CLIP_EXPORT_COLUMNS,
  withClipExportUrls,
  type ClipExportRow,
} from "@/lib/server/clips/exports";

// Every finished clip the user saved, across all their videos, newest first.
// One project's clips (and saving/deleting them) live at /api/clips/[id]/exports.

const LIST_LIMIT = 200;

async function handleGET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("clip_exports")
    .select(CLIP_EXPORT_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT)
    .returns<ClipExportRow[]>();
  if (error) return serverError("clips/exports/all", error, "Could not load your clips");
  return NextResponse.json({ exports: await withClipExportUrls(data ?? []) });
}

export const GET = withApiLogging("/api/clips/exports", handleGET);
