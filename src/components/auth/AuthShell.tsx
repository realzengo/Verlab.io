"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { AuthShowcasePanel } from "@/components/auth/AuthShowcasePanel";

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh w-full bg-surface">
      {/* Showcase panel — desktop only. Fixed width with tight, uniform
          padding so its visible edge lines up with the column boundary —
          otherwise the form panel (which only centers within its own
          column) ends up off-center relative to the panel's true visible
          edge, not just the column split. */}
      <div className="relative hidden shrink-0 p-2 sm:p-4 lg:flex lg:w-[45%]">
        <AuthShowcasePanel />
      </div>

      {/* Form panel — takes all remaining space so centering lines up with
          the showcase panel's real visible edge. */}
      <div className="relative flex w-full flex-1 flex-col items-center justify-center px-6 py-8 sm:px-12 sm:py-10 lg:px-16 lg:py-12 xl:px-20">
        <div className="w-full max-w-[410px] lg:-translate-x-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 14, scale: 0.985, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -14, scale: 0.985, filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
