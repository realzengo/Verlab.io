import type { Agent } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const CATEGORY_LABEL: Record<Agent["category"], string> = {
  hooks: "Hooks",
  rewrite: "Rewrite",
  virality: "Virality",
};

export function AgentCard({ agent, onRun }: { agent: Agent; onRun?: (agent: Agent) => void }) {
  return (
    <Card hoverLift className="flex flex-col gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-chip bg-accent">
        <agent.icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-heading">{agent.name}</h3>
          <Badge>{CATEGORY_LABEL[agent.category]}</Badge>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-body">{agent.description}</p>
      </div>
      <Button size="sm" variant="secondary" className="self-start" onClick={() => onRun?.(agent)}>
        Run agent
      </Button>
    </Card>
  );
}
