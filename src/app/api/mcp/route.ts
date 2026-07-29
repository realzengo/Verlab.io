import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { verifyMcpToken } from "@/lib/server/mcp-auth";
import { createMcpServer } from "@/lib/server/mcp/server";

export const maxDuration = 300;

// One fixed, shareable URL for every user (https://verlab.io/api/mcp) --
// unlike a secret-in-the-path scheme, identity comes entirely from a header
// set when the connector is configured (Claude/ChatGPT's "Add custom
// connector" dialogs both support a Request headers field for exactly this:
// a fixed API key/bearer token instead of full OAuth). Accepts either an
// `Authorization: Bearer <token>` header or a raw `x-api-key` header, since
// clients differ in which of those they expose in their setup UI.
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) return apiKeyHeader.trim();
  return null;
}

// Stateless Streamable HTTP: no sessionIdGenerator, so every request gets a
// fresh McpServer + transport pair scoped to whichever user the header
// token resolves to (see mcp-auth.ts) — nothing is kept in memory between
// requests, which is what makes this safe on Vercel's serverless runtime.
async function handle(request: Request): Promise<Response> {
  const token = extractToken(request);
  const auth = token ? await verifyMcpToken(token) : null;

  if (!auth) {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Missing or invalid Verlab connector credentials — add your API key as an Authorization: Bearer header.",
        },
        id: null,
      },
      { status: 401 }
    );
  }

  const server = createMcpServer(auth.userId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  return transport.handleRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handle(request);
}
