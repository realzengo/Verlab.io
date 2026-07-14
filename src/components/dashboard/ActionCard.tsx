import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "dark" | "primary" | "light";

const VARIANT_CLASSES: Record<Variant, string> = {
  dark: "bg-heading text-white",
  primary: "bg-primary text-white",
  light: "bg-white text-heading border border-hairline",
};

const SUBTITLE_CLASSES: Record<Variant, string> = {
  dark: "text-white/70",
  primary: "text-white/80",
  light: "text-body",
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
        "group flex flex-col justify-between gap-8 rounded-card p-6 transition-shadow hover:shadow-card-hover",
        VARIANT_CLASSES[variant],
        wide ? "sm:flex-row sm:items-center sm:gap-4" : "min-h-[168px]"
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5" />}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className={cn("mt-1.5 text-sm", SUBTITLE_CLASSES[variant])}>{subtitle}</p>
      </div>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5",
          variant === "light" ? "bg-accent text-primary" : "bg-white/15 text-white"
        )}
      >
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
