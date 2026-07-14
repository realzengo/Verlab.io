import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
  hoverLift?: boolean;
}

export function Card({ children, padded = true, hoverLift = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-hairline bg-surface shadow-card",
        padded && "p-5",
        hoverLift && "transition-shadow hover:shadow-card-hover",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
