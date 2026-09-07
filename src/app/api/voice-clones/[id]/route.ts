import { NextRequest, NextResponse } from "next/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { serverError } from "@/lib/server/api-error";
import { createClient } from "@/lib/supabase/server";

// No "delete voice" endpoint exists for a cloned MiniMax voice on Replicate
// (see replicate-voice-clone.ts's module comment) -- this only removes our
// own DB row. The clone becomes unreachable from this app the moment that
// row is gone (voice-resolution.ts's lookupClone requires it), which is the
// only guarantee that actually matters here.
async function handleDELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: row, error: fetchError } = await supabase.from("voice_clones").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (fetchError || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("voice_clones").delete().eq("id", id).eq("user_id", user.id);
  if (deleteError) {
    return serverError("voice-clones DELETE", deleteError);
  }

  return NextResponse.json({ ok: true });
}

export const DELETE = withApiLogging("/api/voice-clones/[id]", handleDELETE);
