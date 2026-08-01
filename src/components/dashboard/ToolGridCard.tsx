import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToolTone = "cat-1" | "cat-2" | "cat-3" | "cat-4" | "cat-5" | "cat-6" | "cat-7";

// Tailwind needs full, static class names to pick them up at build time, so
// each tone maps to a pre-composed set rather than being built with `${}`.
const TONE_CLASSES: Record<ToolTone, { wash: string; chip: string; icon: string }> = {
  "cat-1": { wash: "from-cat-1-tint", chip: "bg-cat-1-tint", icon: "text-cat-1" },
  "cat-2": { wash: "from-cat-2-tint", chip: "bg-cat-2-tint", icon: "text-cat-2" },
  "cat-3": { wash: "from-cat-3-tint", chip: "bg-cat-3-tint", icon: "text-cat-3" },
  "cat-4": { wash: "from-cat-4-tint", chip: "bg-cat-4-tint", icon: "text-cat-4" },
  "cat-5": { wash: "from-cat-5-tint", chip: "bg-cat-5-tint", icon: "text-cat-5" },
  "cat-6": { wash: "from-cat-6-tint", chip: "bg-cat-6-tint", icon: "text-cat-6" },
  "cat-7": { wash: "from-cat-7-tint", chip: "bg-cat-7-tint", icon: "text-cat-7" },
};

interface ToolGridCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: ToolTone;
  cta?: string;
  badge?: string;
  /** Drop a screenshot/mockup into /public/tools and pass its path here -- falls back to a tinted icon tile until then. */
  thumbnail?: string;
  /** Not yet released -- still linked (the destination shows a "coming soon" placeholder), just visibly marked unavailable here. */
  comingSoon?: boolean;
}

export function ToolGridCard({
  title,
  description,
  href,
  icon: Icon,
  tone,
  cta = "Try Now",
  badge,
  thumbnail,
  comingSoon,
}: ToolGridCardProps) {
  const toneClasses = TONE_CLASSES[tone];
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-surface p-0 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-zinc-800 dark:bg-zinc-900",
        comingSoon && "opacity-70"
      )}
    >
      <div className="flex flex-1 flex-col p-2.5">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-card-sm border border-hairline/60">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt=""
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 410px, (min-width: 640px) 50vw, 100vw"
            />
          ) : (
            <div
              className={cn(
                "relative flex h-full w-full items-center justify-center bg-gradient-to-br to-surface dark:bg-none dark:bg-white/[0.04]",
                toneClasses.wash
              )}
            >
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.05]"
                style={{
                  backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
                  backgroundSize: "16px 16px",
                }}
              />
              <span className={cn("relative flex h-12 w-12 items-center justify-center rounded-2xl bg-surface shadow-card sm:h-14 sm:w-14 lg:h-16 lg:w-16", "ring-1 ring-black/[0.03]")}>
                <Icon className={cn("h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8", toneClasses.icon)} strokeWidth={1.6} />
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col pt-1.5 lg:pt-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold tracking-tight text-heading lg:text-base">{title}</h3>
            {(badge || comingSoon) && (
              <span
                className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-[#1E5CFE] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
              >
                {comingSoon && <Lock className="h-2.5 w-2.5" />}
                {comingSoon ? "Soon" : badge}
              </span>
            )}
          </div>
          <p className="mt-0 mb-1 line-clamp-2 text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400 lg:text-xs">{description}</p>
        </div>
      </div>

      <div className="mt-auto px-2.5 pb-2.5">
        <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1E5CFE] py-2 text-sm font-semibold text-white transition-colors lg:py-2.5">
          {comingSoon ? (
            <>
              <Lock className="h-3 w-3" />
              Coming soon
            </>
          ) : (
            <>
              <span className="transition-transform duration-200 group-hover:-translate-x-0.5">{cta}</span>
              <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
            </>
          )}
        </span>
      </div>
    </Link>
  );
}
