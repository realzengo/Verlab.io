import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "dark" | "primary" | "light";

const VARIANT_CLASSES: Record<Variant, string> = {
  dark: "bg-gradient-to-br from-[#1c2437] to-ink text-white",
  primary: "bg-gradient-to-br from-[#5b7fff] to-primary text-white",
  light: "bg-gradient-to-br from-accent to-surface text-heading border border-hairline",
};

const SUBTITLE_CLASSES: Record<Variant, string> = {
  dark: "text-white/70",
  primary: "text-white/80",
  light: "text-body",
};

const ICON_BADGE_CLASSES: Record<Variant, string> = {
  dark: "bg-white/10 text-white",
  primary: "bg-white/15 text-white",
  light: "bg-accent text-primary",
};

interface ActionCardProps {
  variant: Variant;
  title: string;
  subtitle: string;
  href: string;
  icon?: LucideIcon;
  wide?: boolean;
}

export function ActionCard({ variant, title, subtitle, href, icon: Icon, wide }: ActionCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col justify-between gap-8 overflow-hidden rounded-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover",
        VARIANT_CLASSES[variant],
        wide ? "sm:flex-row sm:items-center sm:gap-4" : "min-h-[168px]"
      )}
    >
      {variant !== "light" && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-110"
        />
      )}
      <div className="relative">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", ICON_BADGE_CLASSES[variant])}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
          )}
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        </div>
        <p className={cn("mt-1.5 text-sm", SUBTITLE_CLASSES[variant])}>{subtitle}</p>
      </div>
      <span
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5",
          variant === "light" ? "bg-accent text-primary" : "bg-white/15 text-white"
        )}
      >
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
