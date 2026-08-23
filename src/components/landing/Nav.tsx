"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, Sparkle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
];

export function Nav() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Next's client-side router only scrolls on an actual pathname change --
  // clicking a "/#section" link while already on "/" leaves the hash in the
  // URL but never scrolls. Do it ourselves when we're already home.
  const handleNavLinkClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("/#") || pathname !== "/") return;
    const id = href.slice(2);
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.pushState(null, "", href);
  };

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const trigger = document.getElementById("niches-marquee");
        setIsScrolled(trigger ? trigger.getBoundingClientRect().top <= 90 : window.scrollY > 20);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Full-page takeover locks the page underneath -- there's nothing to
  // scroll-to-dismiss anymore, so this just stops the body from scrolling
  // behind the overlay while it's open.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <header className="fixed top-0 inset-x-0 z-[100] flex justify-center pt-2 transition-all duration-300 ease-in-out sm:pt-3">
      <div
        className={cn(
          "contain-layout transition-[width,max-width] duration-300 ease-in-out",
          isScrolled ? "w-[95%] max-w-5xl sm:w-[88%]" : "w-full max-w-7xl",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between transition-all duration-300 ease-in-out",
            isScrolled
              ? "rounded-xl border border-slate-200 bg-white px-5 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.04)] sm:rounded-2xl sm:px-6 sm:py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
              : "rounded-none border-transparent bg-transparent px-4 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0)] backdrop-blur-[4px] sm:px-8 sm:py-2"
          )}
        >
          <div className="flex w-full items-center justify-between">
            <Link
              href="/"
              className={cn(
                "flex shrink-0 items-center transition-all duration-300 ease-in-out",
                isScrolled ? "-ml-3.5 sm:-ml-4" : "ml-0.5 sm:ml-1",
              )}
            >
              <Image
                src="/verlab-studio-logo.png"
                alt="Verlab Studio"
                width={1200}
                height={356}
                sizes="160px"
                priority
                className="h-9 w-auto dark:hidden sm:h-11"
              />
              <Image
                src="/landing-header-logo-dark.png"
                alt="Verlab"
                width={887}
                height={237}
                sizes="160px"
                className="hidden h-9 w-auto dark:block sm:h-11"
              />
            </Link>

            <div className="hidden items-center gap-8 md:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleNavLinkClick(e, link.href)}
                  className="cursor-pointer text-sm font-medium text-slate-600 transition-colors hover:text-black dark:text-slate-300 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <Link
              href={APP_URL}
              className="btn-flat-blue -mr-2 hidden shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-extrabold tracking-tight antialiased sm:flex sm:gap-2 sm:px-5 sm:py-3 sm:text-sm"
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

      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-[110] flex flex-col bg-white sm:hidden dark:bg-zinc-900"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
              <Link href="/" onClick={() => setMobileOpen(false)} className="flex shrink-0 items-center">
                <Image
                  src="/verlab-studio-logo.png"
                  alt="Verlab Studio"
                  width={1200}
                  height={356}
                  sizes="160px"
                  className="h-9 w-auto dark:hidden"
                />
                <Image
                  src="/landing-header-logo-dark.png"
                  alt="Verlab"
                  width={887}
                  height={237}
                  sizes="160px"
                  className="hidden h-9 w-auto dark:block"
                />
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="-mr-1 flex shrink-0 items-center justify-center p-2 text-slate-700 outline-none focus:outline-none focus-visible:outline-none dark:text-slate-200"
              >
                <X size={24} />
              </button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.08, ease: "easeOut" }}
              className="flex flex-1 flex-col overflow-y-auto"
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    handleNavLinkClick(e, link.href);
                    setMobileOpen(false);
                  }}
                  className="flex items-center justify-between border-b border-slate-100 px-5 py-5 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:text-slate-200 dark:hover:bg-zinc-800"
                >
                  {link.label}
                </Link>
              ))}
            </motion.div>

            <div className="shrink-0 border-t border-slate-200 p-4 dark:border-zinc-800">
              <Link
                href={APP_URL}
                onClick={() => setMobileOpen(false)}
                className="btn-flat-blue flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3.5 text-sm font-extrabold tracking-tight antialiased"
              >
                <Sparkle size={14} className="shrink-0 fill-current" />
                Get Started
                <ArrowRight size={16} className="shrink-0" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
