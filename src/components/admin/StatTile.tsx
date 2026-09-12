import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/charts/Sparkline";
import { cn } from "@/lib/utils";

type Tone = "blue" | "violet" | "green" | "amber";

// Sticker palette -- decoration only. It lives on the icon tile and nowhere
// else on the card: never the CTA, never the surface, never the type.
const TONE_STICKER: Record<Tone, string> = {
  blue: "admin-sticker-blue",
  violet: "admin-sticker-purple",
  green: "admin-sticker-green",
  amber: "admin-sticker-orange",
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
    <Card hoverLift className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span className={cn("admin-sticker flex h-9 w-9 items-center justify-center rounded-lg", TONE_STICKER[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        {trend && trend.length > 1 && <Sparkline data={trend} positive={delta?.isGood ?? true} />}
      </div>
      <div>
        <p className="text-sm text-subtle">{label}</p>
        {/* heading-2 figure -- weight 700 with the tracking pulled in tight. */}
        <p className="mt-1 text-[26px] font-bold leading-[1.23] tracking-[-0.625px] text-heading">{value}</p>
      </div>
      {delta && (
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium",
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
