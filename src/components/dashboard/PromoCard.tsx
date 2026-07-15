import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "blue" | "violet" | "amber";

const PREVIEW_TONE_CLASSES: Record<Tone, string> = {
  blue: "bg-[radial-gradient(circle_at_30%_20%,rgba(51,92,255,0.16),transparent_60%)] bg-accent",
  violet: "bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.16),transparent_60%)] bg-accent",
  amber: "bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.16),transparent_60%)] bg-accent",
};

interface PromoCardProps {
  title: string;
  description: string;
  previewSlot: ReactNode;
  href: string;
  size?: "wide" | "normal";
  tone?: Tone;
}

export function PromoCard({ title, description, previewSlot, href, size = "normal", tone = "blue" }: PromoCardProps) {
  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border border-hairline bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover",
        size === "wide" && "sm:col-span-2"
      )}
    >
      <div className={cn("flex h-44 items-center justify-center px-5", PREVIEW_TONE_CLASSES[tone])}>{previewSlot}</div>
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-heading">{title}</h3>
          <p className="text-sm leading-relaxed text-body">{description}</p>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-xs font-semibold text-heading transition-colors group-hover:border-primary/40 group-hover:bg-accent group-hover:text-primary"
        >
          Try Now
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
