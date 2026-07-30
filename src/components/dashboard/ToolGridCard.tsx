import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToolTone = "cat-1" | "cat-2" | "cat-3" | "cat-5" | "cat-6" | "cat-7";

// Tailwind needs full, static class names to pick them up at build time, so
// each tone maps to a pre-composed set rather than being built with `${}`.
const TONE_CLASSES: Record<ToolTone, { wash: string; chip: string; icon: string }> = {
  "cat-1": { wash: "from-cat-1-tint", chip: "bg-cat-1-tint", icon: "text-cat-1" },
  "cat-2": { wash: "from-cat-2-tint", chip: "bg-cat-2-tint", icon: "text-cat-2" },
  "cat-3": { wash: "from-cat-3-tint", chip: "bg-cat-3-tint", icon: "text-cat-3" },
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
  cta = "Get Started",
  badge,
  thumbnail,
  comingSoon,
}: ToolGridCardProps) {
  const toneClasses = TONE_CLASSES[tone];
  return (
    <Link
      href={href}
      className={cn(
        "tool-card-gradient-border relative flex h-full flex-col overflow-hidden rounded-card-lg border border-hairline bg-surface p-3 shadow-card dark:border-[#132038] dark:bg-[#050b16]",
        comingSoon && "opacity-70"
      )}
    >
      <div className="relative aspect-[15/10] w-full shrink-0 overflow-hidden rounded-card-sm border border-hairline/60">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <div className={cn("relative flex h-full w-full items-center justify-center bg-gradient-to-br to-surface", toneClasses.wash)}>
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
            <span className={cn("relative flex h-14 w-14 items-center justify-center rounded-2xl bg-surface shadow-card", "ring-1 ring-black/[0.03]")}>
              <Icon className={cn("h-7 w-7", toneClasses.icon)} strokeWidth={1.6} />
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2.5 pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-bold tracking-tight text-heading">{title}</h3>
          {(badge || comingSoon) && (
            <span
              className={cn(
                "mt-0.5 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white",
                comingSoon ? "bg-zinc-500" : "bg-btn-primary"
              )}
            >
              {comingSoon && <Lock className="h-2.5 w-2.5" />}
              {comingSoon ? "Soon" : badge}
            </span>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-body">{description}</p>

        <span className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface py-2.5 text-sm font-semibold text-heading transition-colors hover:border-primary/30 hover:bg-accent hover:text-primary dark:border-[#132038] dark:bg-[#0a1526] dark:text-white dark:hover:border-primary/40">
          {comingSoon ? (
            <>
              <Lock className="h-3.5 w-3.5" />
              Coming soon
            </>
          ) : (
            cta
          )}
        </span>
      </div>
    </Link>
  );
}
