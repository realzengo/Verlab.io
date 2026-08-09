import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
  hoverLift?: boolean;
  shadow?: boolean;
}

export function Card({ children, padded = true, hoverLift = false, shadow = true, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-hairline bg-surface",
        shadow && "shadow-card",
        padded && "p-6",
        hoverLift && "transition-[transform,box-shadow] hover:-translate-y-[3px] hover:shadow-card-hover",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
