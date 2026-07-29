import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveMcpToken, issueMcpToken, revokeMcpToken } from "@/lib/server/mcp-auth";

function connectorUrl(request: Request, token: string): string {
  return new URL(`/api/mcp/${token}`, request.url).toString();
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await getActiveMcpToken(user.id);
  return NextResponse.json({ token: existing });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = await issueMcpToken(user.id);
  return NextResponse.json({ url: connectorUrl(request, token) });
}

export async function DELETE(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await revokeMcpToken(user.id);
  return NextResponse.json({ ok: true });
}
