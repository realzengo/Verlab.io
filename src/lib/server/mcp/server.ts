import { after } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { recordApiRequestLog } from "@/lib/server/api-logging";
import { MCP_TOOLS, errorResult, type McpToolDefinition } from "./tools";
import { TOOL_WIDGETS, UNIQUE_WIDGETS } from "./apps/registry";
import { MCP_PUBLIC_ORIGIN } from "./links";

/**
 * Times and logs one MCP tool call for the admin dashboard's endpoint-health
 * table (endpoint "mcp:<tool_name>", method "TOOL_CALL"). A business-level
 * failure comes back as a normal `{ isError: true }` result -- both count as
 * an error here. A thrown exception is logged and turned into a generic,
 * retryable error result rather than reaching the user as a raw message
 * (Postgres/provider errors are not for end users).
 */
function loggedToolHandler(
  toolName: string,
  handler: McpToolDefinition["handler"]
): (userId: string, args: Record<string, unknown>) => ReturnType<McpToolDefinition["handler"]> {
  return async (userId, args) => {
    const start = Date.now();
    const log = (status: number) =>
      after(() => recordApiRequestLog({ endpoint: `mcp:${toolName}`, method: "TOOL_CALL", status, durationMs: Date.now() - start }));
    try {
      const result = await handler(userId, args);
      log("isError" in result && result.isError ? 500 : 200);
      return result;
    } catch (error) {
      console.error(`[mcp:${toolName}]`, error);
      log(500);
      return errorResult("Something went wrong on Verlab's side. Please try again in a moment.", "failed", { retryable: true });
    }
  };
}

// Widgets load images from Verlab's own origin (generated media through
// /api/mcp/media, external thumbnails through the signed /api/mcp/thumb
// proxy) and play audio/video from Supabase Storage, which /api/mcp/media
// redirects to with a fresh signed URL -- media-src follows redirects, so the
// Storage origin has to be allowed too.
function resourceDomains(): string[] {
  const domains = [MCP_PUBLIC_ORIGIN];
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabase) {
    try {
      domains.push(new URL(supabase).origin);
    } catch {
      // Misconfigured env -- media playback is the only thing that degrades.
    }
  }
  return domains;
}

const INSTRUCTIONS = [
  "Verlab is a toolkit for short-form video creators. Every tool shows a live card in the chat; long jobs (videos, clips, voiceovers, research) update their own card until done, so after starting one, tell the user it's on its way instead of polling the check_* tool.",
  "Typical flows: find_niche (pick a niche) -> bend_niche + create_sop (a script playbook from a competitor) -> generate_script with sopId -> generate_voiceover -> generate_image / generate_video for visuals. create_clips turns a long YouTube video into scored viral clips. analyze_creator breaks down one creator. extract_transcript and download_video handle single videos.",
  "Chaining: generate_image returns refs like image:<id>:<n> that generate_video (startImage) and generate_image (referenceImages) accept. extract_transcript ids go into generate_script's transcriptIds. list_voices shows voices including the user's cloned voices. list_library shows past images, videos, voiceovers, clips and SOPs.",
  "Generation tools charge credits; most charge only on success and the rest refund automatically on failure. Don't call get_credit_balance before running tools -- only when the user asks about credits or a tool reports insufficient credits (its message includes a top-up link to share).",
].join("\n\n");

/**
 * Builds a fresh, single-request MCP server scoped to one Verlab user.
 * Streamable HTTP runs stateless (see src/app/api/mcp/route.ts), so a new
 * server + transport pair is created per request -- cheap, since tool
 * registration is just closures over `userId`, and it keeps one user's
 * session from ever bleeding into another's on a shared instance.
 *
 * Every tool renders as a branded MCP App widget (registerAppTool). Hosts
 * without MCP Apps support fall back to the result's text `content`.
 */
export function createMcpServer(userId: string): McpServer {
  const server = new McpServer(
    {
      name: "verlab",
      title: "Verlab",
      version: "2.0.0",
      websiteUrl: "https://verlab.io",
      icons: [
        { src: "https://verlab.io/logo-icon.png", mimeType: "image/png", sizes: ["256x256"] },
        { src: "https://verlab.io/icon.png", mimeType: "image/png", sizes: ["512x512"] },
      ],
    },
    { instructions: INSTRUCTIONS }
  );

  for (const tool of MCP_TOOLS) {
    const widget = TOOL_WIDGETS[tool.name];
    if (!widget) throw new Error(`MCP tool ${tool.name} has no widget registered in apps/registry.ts`);
    registerAppTool(
      server,
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: widget.outputSchema,
        annotations: { title: tool.title, ...tool.annotations },
        _meta: { ui: { resourceUri: widget.resourceUri } },
      },
      async (args) => loggedToolHandler(tool.name, tool.handler)(userId, (args ?? {}) as Record<string, unknown>)
    );
  }

  const domains = resourceDomains();
  // Registered once per unique resource URI -- several tools share one widget.
  for (const widget of UNIQUE_WIDGETS) {
    registerAppResource(
      server,
      widget.resourceUri,
      widget.resourceUri,
      {
        _meta: {
          ui: {
            csp: { resourceDomains: domains },
            prefersBorder: false,
            ...(widget.permissions ? { permissions: widget.permissions } : {}),
          },
        },
      },
      async () => ({
        contents: [
          {
            uri: widget.resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: widget.html,
            _meta: { ui: { csp: { resourceDomains: domains }, prefersBorder: false, ...(widget.permissions ? { permissions: widget.permissions } : {}) } },
          },
        ],
      })
    );
  }

  return server;
}
