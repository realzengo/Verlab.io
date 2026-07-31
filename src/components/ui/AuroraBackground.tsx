"use client";

import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
}

export function AuroraBackground({ className, children, ...props }: AuroraBackgroundProps) {
  return (
    <div className={cn("relative min-h-screen overflow-hidden bg-white z-0 dark:bg-black", className)} {...props}>
      {/* light mode — single centered, restrained wash */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] dark:hidden",
          "[mask-image:linear-gradient(to_bottom,black,transparent)]",
          "[background-image:radial-gradient(55%_70%_at_50%_0%,rgba(37,99,235,0.16)_0%,rgba(37,99,235,0.05)_45%,transparent_75%)]"
        )}
      />

      {/* dark mode — single centered key light fading out before the first card row */}
      <div className="pointer-events-none absolute inset-0 -z-10 hidden dark:block">
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-[320px]",
            "[mask-image:linear-gradient(to_bottom,black_0%,black_10%,transparent_60%)]",
            "[background-image:radial-gradient(55%_75%_at_50%_-5%,rgba(59,130,246,0.32)_0%,rgba(37,99,235,0.10)_35%,transparent_70%)]"
          )}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
