"use client";

import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
}

export function AuroraBackground({ className, children, ...props }: AuroraBackgroundProps) {
  return (
    <div className={cn("relative min-h-screen overflow-hidden bg-white z-0 dark:bg-black", className)} {...props}>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
