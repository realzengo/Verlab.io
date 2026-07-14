import type { FeatureGridItem } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function FeatureCard({ item }: { item: FeatureGridItem }) {
  return (
    <Card hoverLift className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-chip bg-accent">
          <item.icon className="h-5 w-5 text-primary" />
        </div>
        {item.badge && <Badge>{item.badge}</Badge>}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-heading">{item.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-body">{item.description}</p>
      </div>
    </Card>
  );
}
