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
  size?: "wide" | "normal";
  tone?: ToolTone;
}

export function PromoCard({ title, description, previewSlot, href, icon: Icon, size = "normal", tone = "blue" }: PromoCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border border-hairline bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover",
        size === "wide" && "sm:col-span-2"
      )}
    >
      <div className={cn("flex h-44 items-center justify-center px-5", PREVIEW_TONE_CLASSES[tone])}>{previewSlot}</div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TOOL_TONE_CLASSES[tone])}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
          )}
          <h3 className="text-sm font-semibold text-heading">{title}</h3>
        </div>
        <p className="text-sm leading-relaxed text-body">{description}</p>
        <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-xs font-semibold text-heading transition-colors group-hover:border-primary/40 group-hover:bg-accent group-hover:text-primary">
          Try Now
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
