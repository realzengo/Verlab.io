"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";

const MCP_SERVER_URL = "https://api.clypa.io/mcp/v1/sse";

const CONNECT_TABS = [
  { id: "claude", label: "Claude Desktop" },
  { id: "chatgpt", label: "ChatGPT" },
];

const CONNECT_STEPS: Record<string, string[]> = {
  claude: [
    "Open Claude Desktop and go to Settings.",
    "Navigate to the Connectors section.",
    'Click "Add custom connector" and paste the URL above.',
    "Restart Claude Desktop to load the Clypa tools.",
  ],
  chatgpt: [
    "Open ChatGPT Settings.",
    "Navigate to Connected Apps.",
    'Click "Add MCP Server".',
    "Paste the URL above.",
  ],
};

const AVAILABLE_TOOLS = [
  { name: "get_transcript", description: "Fetches the full text of a specific saved transcript." },
  { name: "search_niches", description: "Searches trending niches based on your Clypa parameters." },
  { name: "generate_sop", description: "Extracts the exact script formula from a competitor link." },
];

export default function McpPage() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("claude");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(MCP_SERVER_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="text-2xl font-bold text-heading">Model Context Protocol (MCP)</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-body">
        Connect Clypa directly to Claude Desktop or ChatGPT to search your transcripts, generate scripts, and
        bend niches using AI.
      </p>

      <Card className="mt-6">
        <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Your MCP Server URL</span>
        <div className="mt-3 flex items-center gap-3">
          <div className="min-w-0 flex-1 truncate rounded-card-sm bg-app px-4 py-2.5 font-mono text-sm text-heading">
            {MCP_SERVER_URL}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-btn-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-btn-primary-hover"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </Card>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-heading">How to connect</h2>
        <div className="mt-4">
          <Tabs items={CONNECT_TABS} active={activeTab} onChange={setActiveTab} />
        </div>
        <Card className="mt-4">
          <ol className="flex flex-col gap-4">
            {CONNECT_STEPS[activeTab].map((step, i) => (
              <li key={step} className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <p className="pt-1 text-sm leading-relaxed text-body">{step}</p>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold text-heading">Available Tools</h2>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Tool</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {AVAILABLE_TOOLS.map((tool) => (
              <TableRow key={tool.name}>
                <TableCell>
                  <code className="rounded bg-app px-2 py-1 font-mono text-xs text-heading">{tool.name}</code>
                </TableCell>
                <TableCell className="text-body">{tool.description}</TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
