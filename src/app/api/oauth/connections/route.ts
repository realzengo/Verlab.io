import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listConnections, revokeConnection } from "@/lib/server/oauth/tokens";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const connections = await listConnections(user.id);
  return NextResponse.json({ connections });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { clientId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  await revokeConnection(user.id, body.clientId);
  return NextResponse.json({ ok: true });
}
