import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// Same dotted texture as the landing page's VerlabProcess step cards, reused
// here so the dashboard preview reads as the same visual family.
const DOT_PATTERN = {
  backgroundImage: "radial-gradient(#ffffff40 1px, transparent 1px)",
  backgroundSize: "12px 12px",
};

interface ToolCardProps {
  title: string;
  description: string;
  previewSlot: ReactNode;
  href: string;
  cta?: string;
  beta?: boolean;
  /** Not yet released -- still linked (the destination shows a "coming soon" placeholder), just visibly marked unavailable here. */
  comingSoon?: boolean;
  className?: string;
}

export function ToolCard({
  title,
  description,
  previewSlot,
  href,
  cta = "Try now",
  beta,
  comingSoon,
  className,
}: ToolCardProps) {
  return (
    <div
      className={cn(
        "rounded-card-lg bg-zinc-100 p-2 dark:bg-white/5",
        comingSoon && "opacity-70",
        className
      )}
    >
      <Link
        href={href}
        className="group flex flex-col overflow-hidden rounded-[1rem] bg-surface shadow-card transition-all duration-700 hover:-translate-y-1 hover:shadow-card-hover"
      >
        <div className="relative flex h-44 shrink-0 items-center justify-center overflow-hidden border-b-4 border-surface bg-gradient-to-b from-primary to-surface px-6">
          <div aria-hidden className="absolute inset-0" style={DOT_PATTERN} />
          <div className="relative z-10 flex items-center justify-center">{previewSlot}</div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-heading">{title}</h3>
            {beta && (
              <span className="rounded-full bg-btn-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Beta
              </span>
            )}
            {comingSoon && (
              <span className="flex items-center gap-1 rounded-full bg-zinc-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                <Lock className="h-2.5 w-2.5" />
                Soon
              </span>
            )}
          </div>
          <p className="mb-5 mt-1 text-xs font-normal leading-snug text-body">{description}</p>
          <span className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-2xl bg-btn-primary py-3.5 text-sm font-semibold text-white transition-colors group-hover:bg-btn-primary-hover">
            {comingSoon ? "Coming soon" : cta}
            {comingSoon ? <Lock className="h-3.5 w-3.5" /> : <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </span>
        </div>
      </Link>
    </div>
  );
}
