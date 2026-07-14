import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "new";

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "bg-accent text-primary",
  success: "bg-green-50 text-green-700 border border-green-200",
  new: "bg-heading text-white",
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
