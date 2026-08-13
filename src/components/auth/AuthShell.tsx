"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { AuthShowcasePanel } from "@/components/auth/AuthShowcasePanel";

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full bg-surface">
      {/* Form panel */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 pb-16 pt-8 sm:px-12 sm:pt-10 lg:w-1/2 lg:shrink-0 lg:px-16 lg:pb-20 lg:pt-12 xl:px-20">
        <Link href="/" className="relative block h-8 w-8 shrink-0">
          <Image src="/logo-icon.png" alt="Verlab" fill className="object-contain" sizes="32px" priority />
        </Link>

        <div className="mt-12 w-full max-w-[380px] sm:mt-14 lg:mt-16">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Showcase panel — desktop only */}
      <div className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden bg-[#EEF1FB] px-10 pb-10 pt-12 dark:bg-[#0b0d16] lg:flex xl:pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)] dark:opacity-[0.1]"
          style={{
            backgroundImage: "radial-gradient(circle, #c7cee8 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <AuthShowcasePanel />
      </div>
    </div>
  );
}
