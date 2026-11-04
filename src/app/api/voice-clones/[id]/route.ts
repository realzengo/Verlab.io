import { NextRequest, NextResponse } from "next/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { deleteClone, getClone } from "@/lib/server/voice-clones";
import { createClient } from "@/lib/supabase/server";

// Removes the clone's record and preview (see deleteClone() for why the
// voice itself can't be removed from MiniMax). Past voiceovers made with it
// keep playing -- their audio is already stored -- but it can't be used for
// anything new.
async function handleDELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!(await getClone(user.id, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await deleteClone(user.id, id);
  } catch (error) {
    console.error("[voice-clones DELETE]", error);
    return NextResponse.json({ error: "Could not delete that voice. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export const DELETE = withApiLogging("/api/voice-clones/[id]", handleDELETE);
