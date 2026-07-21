import { CodeSnippet } from "@/components/ui/CodeSnippet";

const MCP_SNIPPET = `{
  "mcpServers": {
    "verlab": {
      "url": "https://mcp.verlab.io/v1",
      "auth": "Bearer YOUR_VERLAB_API_KEY"
    }
  }
}`;

export function McpTab() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-body">Connect via MCP</h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-body">
          Add this to your Claude or ChatGPT MCP configuration to bend niches, pull transcripts, and build SOPs
          directly from your AI workflow.
        </p>
      </div>
      <CodeSnippet code={MCP_SNIPPET} language="json" />
    </div>
  );
}
