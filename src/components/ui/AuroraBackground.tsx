"use client";

import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export function AuroraBackground({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) {
  const maskClass =
    showRadialGradient &&
    `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]`;

  return (
    <div className={cn("relative bg-app", className)} {...props}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* light mode: multicolor swirl */}
        <div
          className={cn(
            `
          dark:hidden
          [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)]
          [--aurora:repeating-linear-gradient(100deg,var(--blue-500)_10%,var(--indigo-300)_15%,var(--blue-300)_20%,var(--violet-200)_25%,var(--blue-400)_30%)]
          [background-image:var(--white-gradient),var(--aurora)]
          [background-size:300%,_200%]
          [background-position:50%_50%,50%_50%]
          filter blur-[10px] invert
          after:content-[""] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)]
          after:[background-size:200%,_100%]
          after:animate-aurora after:[background-attachment:fixed] after:mix-blend-difference
          absolute -inset-[10px] opacity-50 will-change-transform`,
            maskClass
          )}
        />
        {/* dark mode: calm navy/blue gradient, no harsh blend artifacts */}
        <div
          className={cn(
            `
          hidden dark:block
          [background-image:var(--aurora-dark)]
          bg-[length:200%_200%]
          animate-aurora
          absolute -inset-[10px] opacity-80 blur-[60px] will-change-transform`,
            maskClass
          )}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
