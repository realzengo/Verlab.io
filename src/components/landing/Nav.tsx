"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
];

export function Nav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const workflowSection = document.getElementById("workflow");
      setIsScrolled(workflowSection ? workflowSection.getBoundingClientRect().top <= 88 : window.scrollY > 20);
    };
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onScroll = () => setMobileOpen(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mobileOpen]);

  return (
    <header className="fixed top-0 inset-x-0 z-[100] flex justify-center pt-2 transition-all duration-300 ease-in-out sm:pt-3">
      <div
        className={cn(
          "transition-[width,max-width] duration-300 ease-in-out",
          isScrolled ? "w-[95%] max-w-5xl sm:w-[88%]" : "w-full max-w-7xl",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between transition-all duration-300 ease-in-out",
            isScrolled
              ? "rounded-xl border border-slate-200 bg-white px-5 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.04)] sm:rounded-2xl sm:px-6 sm:py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
              : "rounded-none border-transparent bg-transparent px-4 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0)] sm:px-8 sm:py-2"
          )}
        >
          <div className="flex w-full items-center justify-between">
            <Link
              href="/"
              className={cn(
                "flex shrink-0 items-center transition-all duration-300 ease-in-out",
                isScrolled ? "-ml-3 sm:-ml-4" : "ml-2 sm:ml-1",
              )}
            >
              <Image
                src="/verlab-studio-logo.png"
                alt="Verlab Studio"
                width={9342}
                height={2768}
                unoptimized
                priority
                className="h-10 w-auto dark:hidden sm:h-12"
              />
              <Image
                src="/landing-header-logo-dark.png"
                alt="Verlab"
                width={887}
                height={237}
                unoptimized
                priority
                className="hidden h-10 w-auto dark:block sm:h-12"
              />
            </Link>

            <div className="hidden items-center gap-8 md:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="cursor-pointer text-sm font-medium text-slate-600 transition-colors hover:text-black dark:text-slate-300 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <Link
              href="/app"
              className="-mr-2 hidden shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-btn-primary px-3.5 py-2 text-xs font-bold text-white transition-transform hover:scale-105 sm:flex sm:gap-2 sm:px-5 sm:py-3 sm:text-sm"
            >
              <span className="sm:hidden">Get Started</span>
              <span className="hidden sm:inline">Try Verlab Now</span>
              <ArrowRight size={16} className="shrink-0" />
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              className="-mr-1 flex shrink-0 items-center justify-center p-2 text-slate-700 outline-none focus:outline-none focus-visible:outline-none sm:hidden dark:text-slate-200"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out sm:hidden",
            mobileOpen ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div
              className={cn(
                "flex flex-col gap-1 border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-900",
                isScrolled ? "rounded-xl" : "rounded-none",
                mobileOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
              )}
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-black dark:text-slate-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/app"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "mt-1 flex items-center justify-center gap-1.5 bg-btn-primary px-4 py-3 text-sm font-bold text-white transition-all duration-300 ease-in-out",
                  isScrolled ? "rounded-xl" : "rounded-none",
                )}
              >
                Get Started
                <ArrowRight size={16} className="shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
