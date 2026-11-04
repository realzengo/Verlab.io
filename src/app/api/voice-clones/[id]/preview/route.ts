import { NextRequest, NextResponse } from "next/server";
import { withApiLogging } from "@/lib/server/api-logging";
import { getClone, signedClonePreviewUrl } from "@/lib/server/voice-clones";
import { createClient } from "@/lib/supabase/server";

// A clone's preview is rendered once, when it's created (see POST
// /api/voice-clones), and stored -- this only hands out a short-lived link
// to that file, so playing it never generates anything. A redirect rather
// than JSON so the picker can use this URL directly as an <audio> src: the
// link it lands on is always fresh.
async function handleGET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const clone = await getClone(user.id, id);
  if (!clone?.hasPreview) return NextResponse.json({ error: "This voice has no preview" }, { status: 404 });

  const url = await signedClonePreviewUrl(user.id, id);
  if (!url) return NextResponse.json({ error: "This voice has no preview" }, { status: 404 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}

export const GET = withApiLogging("/api/voice-clones/[id]/preview", handleGET);
