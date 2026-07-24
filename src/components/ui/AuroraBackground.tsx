"use client";

import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
}

const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function AuroraBackground({ className, children, ...props }: AuroraBackgroundProps) {
  return (
    <div className={cn("relative min-h-screen overflow-hidden bg-white z-0 dark:bg-[#08090D]", className)} {...props}>
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
            "absolute inset-x-0 top-0 h-[480px]",
            "[mask-image:linear-gradient(to_bottom,black_0%,black_15%,transparent_78%)]",
            "[background-image:radial-gradient(55%_75%_at_50%_-5%,rgba(59,130,246,0.40)_0%,rgba(37,99,235,0.14)_35%,transparent_72%)]"
          )}
        />
        <div className="absolute inset-0 [background-image:radial-gradient(120%_90%_at_50%_-10%,transparent_45%,rgba(0,0,0,0.45)_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{ backgroundImage: NOISE_BG }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
