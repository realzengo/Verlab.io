import { Plug } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CodeSnippet } from "@/components/ui/CodeSnippet";

const MCP_SNIPPET = `{
  "mcpServers": {
    "clypa": {
      "url": "https://mcp.clypa.io/v1",
      "auth": "Bearer YOUR_CLYPA_API_KEY"
    }
  }
}`;

const REST_SNIPPET = `curl https://api.clypa.io/v1/bend \\
  -H "Authorization: Bearer YOUR_CLYPA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sourceNiche": "Medical Malpractice",
    "targetNiche": "Corporate Fraud"
  }'`;

export function DeveloperBand() {
  return (
    <section id="developers" className="bg-ink">
      <div className="mx-auto max-w-6xl px-4 py-[90px] sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-3">
          <Badge variant="new" className="flex items-center gap-1.5">
            <Plug className="h-3 w-3" />
            Developer favorite
          </Badge>
          <h2 className="text-[32px] font-semibold leading-[1.05] tracking-[-1px] text-white sm:text-[40px]">
            Build on Clypa
          </h2>
          <p className="max-w-xl text-[17px] leading-relaxed text-white/60">
            Connect Clypa to Claude or ChatGPT via MCP, or call the REST API directly from your own
            pipeline.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">MCP endpoint</span>
            <CodeSnippet code={MCP_SNIPPET} language="json" />
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">REST API</span>
            <CodeSnippet code={REST_SNIPPET} language="bash" />
          </div>
        </div>

        <Button href="/app/settings/api" variant="secondary" className="mt-8">
          View API docs
        </Button>
      </div>
    </section>
  );
}
