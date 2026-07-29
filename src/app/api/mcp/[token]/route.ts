import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { verifyMcpToken } from "@/lib/server/mcp-auth";
import { createMcpServer } from "@/lib/server/mcp/server";

export const maxDuration = 300;

// Stateless Streamable HTTP: no sessionIdGenerator, so every request gets a
// fresh McpServer + transport pair scoped to whichever user the path token
// resolves to (see mcp-auth.ts) — nothing is kept in memory between
// requests, which is what makes this safe on Vercel's serverless runtime.
async function handle(request: Request, token: string): Promise<Response> {
  const auth = await verifyMcpToken(token);
  if (!auth) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Invalid or revoked MCP connector link" }, id: null },
      { status: 401 }
    );
  }

  const server = createMcpServer(auth.userId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  return transport.handleRequest(request);
}

type RouteParams = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  const { token } = await params;
  return handle(request, token);
}

export async function GET(request: Request, { params }: RouteParams): Promise<Response> {
  const { token } = await params;
  return handle(request, token);
}

export async function DELETE(request: Request, { params }: RouteParams): Promise<Response> {
  const { token } = await params;
  return handle(request, token);
}
