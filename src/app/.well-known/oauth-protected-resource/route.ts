import { NextResponse } from "next/server";

// RFC 9728 Protected Resource Metadata -- when a client gets a 401 from
// /api/mcp, it follows the WWW-Authenticate header's resource_metadata URL
// here to find out which authorization server protects that resource.
export async function GET(request: Request): Promise<NextResponse> {
  const { origin } = new URL(request.url);

  return NextResponse.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
  });
}
