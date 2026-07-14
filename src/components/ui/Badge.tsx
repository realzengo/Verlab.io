import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "new";

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "bg-accent text-primary",
  success: "bg-success-tint text-success border border-success/20",
  warning: "bg-warning-tint text-warning border border-warning/20",
  danger: "bg-danger-tint text-danger border border-danger/20",
  new: "bg-ink text-white",
};

export function Badge({
  variant = "default",
  children,
  className,
}: {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
