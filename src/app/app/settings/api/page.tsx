"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { ApiKeyTable } from "./_components/ApiKeyTable";
import { McpTab } from "./_components/McpTab";

const TABS = [
  { id: "keys", label: "API keys" },
  { id: "mcp", label: "MCP" },
];

export default function ApiSettingsPage() {
  const [tab, setTab] = useState("keys");

  return (
    <div className="flex flex-col gap-6">
      <Tabs items={TABS} active={tab} onChange={setTab} />
      {tab === "keys" ? <ApiKeyTable /> : <McpTab />}
    </div>
  );
}
