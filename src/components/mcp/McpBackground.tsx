"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function McpBackground({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("relative z-0 min-h-screen overflow-hidden bg-white dark:bg-black", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] opacity-30 [background-image:linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,black_55%,transparent)] dark:opacity-20 dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.15)_1px,transparent_1px)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]">
        <div className="absolute -top-24 left-[12%] h-72 w-72 rounded-full bg-blue-600/15 blur-[110px] dark:bg-blue-600/25" />
        <div className="absolute top-1/4 right-[6%] h-96 w-96 rounded-full bg-blue-500/15 blur-[130px] dark:bg-blue-500/25" />
        <div className="absolute bottom-[-220px] left-1/2 h-80 w-[680px] -translate-x-1/2 rounded-full bg-blue-500/15 blur-[140px] dark:bg-blue-500/35" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
