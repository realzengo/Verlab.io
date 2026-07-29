import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveMcpToken, issueMcpToken, revokeMcpToken } from "@/lib/server/mcp-auth";

// One fixed URL for every user — see src/app/api/mcp/route.ts. Identity
// comes from the Authorization header the user configures when adding the
// connector, not from anything in the URL, so this never needs a per-user
// value and can be shown/copied freely without ever being regenerated.
function connectorUrl(request: Request): string {
  return new URL("/api/mcp", request.url).toString();
}

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await getActiveMcpToken(user.id);
  return NextResponse.json({ url: connectorUrl(request), token: existing });
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
  return NextResponse.json({ url: connectorUrl(request), apiKey: token });
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
