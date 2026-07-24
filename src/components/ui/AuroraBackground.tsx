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
    `[mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_35%,var(--transparent)_100%)]`;

  return (
    <div className={cn("relative bg-app", className)} {...props}>
      <div className="pointer-events-none absolute inset-0 isolate overflow-hidden">
        {/* soft brand-blue/indigo mesh glow — same treatment light & dark */}
        <div
          className={cn(
            `
          [background-image:var(--aurora-light)]
          dark:[background-image:var(--aurora-dark)]
          bg-[length:180%_180%]
          animate-aurora
          absolute -inset-[10px] opacity-100 blur-[70px] will-change-transform
          dark:opacity-55 dark:blur-[90px]`,
            maskClass
          )}
        />
        {/* fine grid texture for structure — reads as a crafted dashboard, not a flat page */}
        <div
          className={cn(
            `
          absolute inset-0
          [background-image:linear-gradient(to_right,rgba(17,24,39,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(17,24,39,0.035)_1px,transparent_1px)]
          dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)]
          [background-size:44px_44px]`,
            maskClass
          )}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
