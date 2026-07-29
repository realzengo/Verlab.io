import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { MCP_TOOLS } from "./tools";
import { TOOL_WIDGETS, UNIQUE_WIDGETS } from "./apps/registry";

// Every widget's CSP allows loading images only from Verlab's own origin --
// external thumbnails go through the signed /api/mcp/thumb proxy (see
// thumb-proxy.ts) instead of allowlisting arbitrary/rotating CDN hosts.
const RESOURCE_DOMAINS = ["https://verlab.io"];

/**
 * Builds a fresh, single-request MCP server scoped to one Verlab user.
 * Streamable HTTP is used in stateless mode (see mcp/[token]/route.ts), so a
 * new McpServer + transport pair is created per request rather than kept
 * alive across requests — cheap since tool registration is just closures
 * over `userId`, and it keeps one user's session from ever bleeding into
 * another's on a shared serverless instance.
 *
 * Every tool renders as a branded MCP App widget (registerAppTool, not the
 * base SDK's registerTool) — see src/lib/server/mcp/apps/. Hosts without MCP
 * Apps support (the `_meta.ui` extension, shipped by Claude/ChatGPT as of
 * Jan 2026) just fall back to the tool result's plain `content`, so this
 * degrades gracefully rather than needing capability-gated dual
 * registration.
 */
export function createMcpServer(userId: string): McpServer {
  const server = new McpServer(
    {
      name: "verlab",
      title: "Verlab",
      version: "1.0.0",
      websiteUrl: "https://verlab.io",
      icons: [{ src: "https://verlab.io/logo-icon.png", mimeType: "image/png", sizes: ["2363x2363"] }],
    },
    {
      instructions:
        "Verlab tools for short-form video creators: trending niche research, single-creator content-strategy analysis (real transcripts, not just metadata), script generation, image generation, transcript extraction, and video downloads. Script/image/transcript/download/creator-analysis tools charge credits — call get_credit_balance first if a balance might be too low.",
    }
  );

  for (const tool of MCP_TOOLS) {
    const widget = TOOL_WIDGETS[tool.name];
    registerAppTool(
      server,
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: widget.outputSchema,
        _meta: { ui: { resourceUri: widget.resourceUri } },
      },
      async (args) => tool.handler(userId, (args ?? {}) as Record<string, unknown>)
    );
  }

  // Registered once per unique resource URI, not once per tool -- several
  // tools intentionally share one widget (see apps/registry.ts).
  for (const widget of UNIQUE_WIDGETS) {
    registerAppResource(
      server,
      widget.resourceUri,
      widget.resourceUri,
      { _meta: { ui: { csp: { resourceDomains: RESOURCE_DOMAINS } } } },
      async () => ({
        contents: [{ uri: widget.resourceUri, mimeType: RESOURCE_MIME_TYPE, text: widget.html }],
      })
    );
  }

  return server;
}
