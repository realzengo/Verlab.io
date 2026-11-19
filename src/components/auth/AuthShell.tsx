"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { AuthShowcasePanel } from "@/components/auth/AuthShowcasePanel";

// Auth pages are served from app.verlab.io, where "/" is the dashboard --
// the logo goes back to the marketing site instead (same dev split as
// APP_URL in src/lib/constants.ts).
const SITE_URL = process.env.NODE_ENV === "production" ? "https://verlab.io" : "http://localhost:3000";

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh w-full bg-white">
      {/* Form column: logo pinned top-left, form centered, legal row at the
          bottom. Full width below lg, where the grey panel is hidden. */}
      <div className="flex min-h-dvh w-full flex-1 flex-col">
        <header className="px-6 pt-6 sm:px-10 sm:pt-8 lg:px-[12%]">
          <a href={SITE_URL} aria-label="Verlab home" className="inline-flex">
            <Image
              src="/verlab-studio-logo.png"
              alt="Verlab Studio"
              width={1600}
              height={474}
              sizes="140px"
              priority
              className="h-8 w-auto sm:h-9"
            />
          </a>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[380px]">
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
        </main>

        <footer className="flex items-center justify-between gap-4 px-6 pb-6 text-[13px] text-subtle sm:px-10 sm:pb-8">
          <span>&copy; {new Date().getFullYear()} Verlab</span>
          <nav className="flex items-center gap-4">
            <Link href="/legal/terms" className="transition-colors hover:text-heading">
              Terms
            </Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-heading">
              Privacy
            </Link>
          </nav>
        </footer>
      </div>

      {/* Grey showcase panel, desktop only. Sticky so it stays put if the
          form column ever grows past the viewport. */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 bg-[#f5f5f6] lg:block lg:w-[42%] xl:w-[40%]">
        <AuthShowcasePanel />
      </aside>
    </div>
  );
}
