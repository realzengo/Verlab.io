import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { verifyAccessToken } from "@/lib/server/oauth/tokens";
import { createMcpServer } from "@/lib/server/mcp/server";

export const maxDuration = 300;

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// One fixed URL for every user (https://verlab.io/api/mcp). Identity comes
// from a real OAuth 2.1 access token (see /oauth/authorize, /api/oauth/token)
// rather than anything in the URL or a manually-configured header -- this is
// what lets Claude/ChatGPT's native "Connect" button work, since it drives a
// real OAuth handshake instead of erroring out looking for one.
async function handle(request: Request): Promise<Response> {
  const token = extractBearerToken(request);
  const auth = token ? await verifyAccessToken(token) : null;

  if (!auth) {
    const { origin } = new URL(request.url);
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Missing or invalid access token" }, id: null },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
        },
      }
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
