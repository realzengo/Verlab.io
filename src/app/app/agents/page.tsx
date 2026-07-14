"use client";

import { AGENTS } from "@/lib/mock-data";
import { AgentCard } from "@/components/features/AgentCard";

export default function AgentsPage() {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-heading">AI Agents</h2>
        <p className="mt-1 text-sm text-body">Hooks, rewrites, and virality breakdowns, on demand.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
