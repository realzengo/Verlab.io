import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "dark" | "primary" | "light";

const VARIANT_CLASSES: Record<Variant, string> = {
  dark: "bg-gradient-to-br from-white to-zinc-50 border border-zinc-200/80 text-zinc-900 dark:from-zinc-800 dark:to-zinc-900 dark:border-white/10 dark:text-white",
  primary:
    "bg-gradient-to-br from-white to-zinc-50 border border-zinc-200/80 text-zinc-900 dark:from-zinc-800 dark:to-zinc-900 dark:border-white/10 dark:text-white",
  light: "bg-gradient-to-br from-accent to-surface text-heading border border-hairline",
};

const SUBTITLE_CLASSES: Record<Variant, string> = {
  dark: "text-zinc-500 dark:text-zinc-400",
  primary: "text-zinc-500 dark:text-zinc-400",
  light: "text-body",
};

const ICON_BADGE_CLASSES: Record<Variant, string> = {
  dark: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  primary: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  light: "bg-accent text-primary",
};

const ARROW_BADGE_CLASSES: Record<Variant, string> = {
  dark: "bg-zinc-900/5 text-zinc-600 group-hover:bg-indigo-500/10 group-hover:text-indigo-600 dark:bg-white/10 dark:text-white dark:group-hover:bg-indigo-500/20 dark:group-hover:text-indigo-300",
  primary:
    "bg-zinc-900/5 text-zinc-600 group-hover:bg-indigo-500/10 group-hover:text-indigo-600 dark:bg-white/10 dark:text-white dark:group-hover:bg-indigo-500/20 dark:group-hover:text-indigo-300",
  light: "bg-accent text-primary",
};

interface ActionCardProps {
  variant: Variant;
  title: string;
  subtitle: string;
  href: string;
  icon?: LucideIcon;
  wide?: boolean;
  className?: string;
}

export function ActionCard({ variant, title, subtitle, href, icon: Icon, wide, className }: ActionCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col justify-between gap-8 overflow-hidden rounded-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10",
        variant === "light" ? "hover:border-indigo-500/50" : "hover:border-indigo-500/40",
        VARIANT_CLASSES[variant],
        wide ? "sm:flex-row sm:items-center sm:gap-4" : "min-h-[168px]",
        className
      )}
    >
      {variant !== "light" && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl transition-transform duration-500 group-hover:scale-110"
        />
      )}
      <div className="relative">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", ICON_BADGE_CLASSES[variant])}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
          )}
          <h3 className="text-lg font-bold tracking-tight">{title}</h3>
        </div>
        <p className={cn("mt-1.5 text-sm font-normal", SUBTITLE_CLASSES[variant])}>{subtitle}</p>
      </div>
      <span
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
          ARROW_BADGE_CLASSES[variant]
        )}
      >
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
