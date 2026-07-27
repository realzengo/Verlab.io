import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/charts/Sparkline";
import { cn } from "@/lib/utils";

type Tone = "blue" | "violet" | "green" | "amber";

const TONE_CLASSES: Record<Tone, string> = {
  blue: "bg-accent text-primary",
  violet: "bg-[#f3e8ff] text-[#7c3aed] dark:bg-violet-400/15 dark:text-violet-300",
  green: "bg-success-tint text-success",
  amber: "bg-warning-tint text-warning",
};

interface StatTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  delta?: { value: string; direction: "up" | "down"; isGood: boolean; period: string };
  trend?: number[];
}

export function StatTile({ label, value, icon: Icon, tone = "blue", delta, trend }: StatTileProps) {
  return (
    <Card className="flex flex-col gap-3" hoverLift>
      <div className="flex items-start justify-between">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", TONE_CLASSES[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        {trend && trend.length > 1 && <Sparkline data={trend} positive={delta?.isGood ?? true} />}
      </div>
      <div>
        <p className="text-sm font-medium text-body">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-heading">{value}</p>
      </div>
      {delta && (
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5",
              delta.isGood ? "bg-success-tint text-success" : "bg-danger-tint text-danger"
            )}
          >
            {delta.direction === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {delta.value}
          </span>
          <span className="text-subtle">{delta.period}</span>
        </div>
      )}
    </Card>
  );
}
