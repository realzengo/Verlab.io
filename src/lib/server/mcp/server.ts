import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCP_TOOLS } from "./tools";

/**
 * Builds a fresh, single-request MCP server scoped to one Verlab user.
 * Streamable HTTP is used in stateless mode (see mcp/[token]/route.ts), so a
 * new McpServer + transport pair is created per request rather than kept
 * alive across requests — cheap since tool registration is just closures
 * over `userId`, and it keeps one user's session from ever bleeding into
 * another's on a shared serverless instance.
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
        "Verlab tools for short-form video creators: trending niche research, script generation, image generation, transcript extraction, and video downloads. Script/image/transcript/download tools charge credits — call get_credit_balance first if a balance might be too low.",
    }
  );

  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.inputSchema },
      async (args) => tool.handler(userId, (args ?? {}) as Record<string, unknown>)
    );
  }

  return server;
}
