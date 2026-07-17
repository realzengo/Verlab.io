import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import type { ToolTone } from "@/lib/types";
import { TOOL_TONE_CLASSES } from "@/lib/tone";
import { cn } from "@/lib/utils";

const PREVIEW_TONE_CLASSES: Record<ToolTone, string> = {
  blue: "bg-[radial-gradient(circle_at_30%_20%,rgba(51,92,255,0.16),transparent_60%)] bg-accent",
  violet: "bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.16),transparent_60%)] bg-accent",
  amber: "bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.16),transparent_60%)] bg-accent",
  green: "bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.16),transparent_60%)] bg-accent",
  rose: "bg-[radial-gradient(circle_at_30%_20%,rgba(244,63,94,0.16),transparent_60%)] bg-accent",
  sky: "bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.16),transparent_60%)] bg-accent",
};

interface PromoCardProps {
  title: string;
  description: string;
  previewSlot: ReactNode;
  href: string;
  icon?: LucideIcon;
  size?: "wide" | "normal" | "hero";
  tone?: ToolTone;
  className?: string;
}

export function PromoCard({
  title,
  description,
  previewSlot,
  href,
  icon: Icon,
  size = "normal",
  tone = "blue",
  className,
}: PromoCardProps) {
  const isHero = size === "hero";

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border border-hairline bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10",
        size === "wide" && "sm:col-span-2",
        isHero && "flex-1",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center px-5",
          isHero ? "flex-1 min-h-[200px] py-8" : "h-44",
          PREVIEW_TONE_CLASSES[tone]
        )}
      >
        {previewSlot}
      </div>
      <div className={cn("flex flex-col gap-3 p-5", !isHero && "flex-1")}>
        <div className="flex items-center gap-3">
          {Icon && (
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl",
                isHero ? "h-10 w-10" : "h-9 w-9",
                TOOL_TONE_CLASSES[tone]
              )}
            >
              <Icon className={isHero ? "h-5 w-5" : "h-[18px] w-[18px]"} />
            </span>
          )}
          <h3 className={cn("font-bold text-heading", isHero ? "text-base" : "text-sm")}>{title}</h3>
        </div>
        <p className="text-sm font-normal leading-relaxed text-body">{description}</p>
        <span className="btn-bevel mt-auto inline-flex w-fit items-center gap-1 rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-xs font-semibold text-heading transition-colors group-hover:border-primary/40 group-hover:bg-accent group-hover:text-primary">
          Try Now
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
