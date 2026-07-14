import type { FeatureGridItem } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function FeatureCard({ item }: { item: FeatureGridItem }) {
  return (
    <Card hoverLift className="flex flex-col gap-0">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-chip bg-accent">
        <item.icon className="h-[22px] w-[22px] text-primary" strokeWidth={1.8} />
      </div>
      <h3 className="text-[19px] font-bold tracking-[-0.2px] text-heading">{item.title}</h3>
      <p className="mt-2 text-sm leading-[1.6] text-subtle">{item.description}</p>
      {item.badge && <Badge className="mt-3.5 w-fit">{item.badge}</Badge>}
    </Card>
  );
}
