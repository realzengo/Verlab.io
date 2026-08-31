"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowUpRight, Menu, Sparkle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";
import { GlassCtaButton } from "@/components/landing/GlassCtaButton";

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

  // A single threshold flip -- not a value tied to scroll distance. Crossing it
  // just sets a boolean, and the CSS transition below (duration-500) is what
  // actually plays the fade/resize, so the morph always takes the same ~0.5s
  // regardless of how fast or far the user scrolls.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 20);
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
    <header className="fixed top-0 inset-x-0 z-[100] flex justify-center pt-4 sm:pt-5">
      <div
        className={cn(
          "contain-layout transition-[width,max-width] duration-500 ease-in-out",
          isScrolled ? "w-[92%] max-w-5xl sm:w-[80%]" : "w-full max-w-7xl",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between transition-all duration-500 ease-in-out",
            isScrolled
              ? "rounded-[20px] border border-white/70 bg-white px-6 py-2.5 shadow-[0_8px_30px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]"
              : "rounded-none border-transparent bg-transparent px-4 py-2.5 shadow-none sm:px-8 sm:py-2",
          )}
        >
          <div className="flex w-full items-center justify-between">
            <Link
              href="/"
              className={cn(
                "flex shrink-0 items-center transition-all duration-500 ease-in-out",
                isScrolled ? "-ml-3.5" : "ml-0.5",
              )}
            >
              <Image
                src="/verlab-studio-logo.png"
                alt="Verlab Studio"
                width={1600}
                height={474}
                sizes="160px"
                priority
                className="h-9 w-auto sm:h-11"
              />
            </Link>

            <div className="hidden items-center gap-8 md:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleNavLinkClick(e, link.href)}
                  className={cn(
                    "font-ui cursor-pointer text-lg font-medium transition-colors",
                    "text-heading hover:text-heading/70",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <GlassCtaButton
              href={APP_URL}
              radius={14}
              className="-mr-2 hidden! shrink-0 whitespace-nowrap text-white! sm:flex!"
              style={{
                backgroundImage: "none",
                backgroundColor: "#335cff",
                backgroundBlendMode: "normal",
                boxShadow: "none",
              }}
            >
              <span className="sm:hidden">Get Started</span>
              <span className="hidden sm:inline">Try Verlab Now</span>
              <ArrowRight size={16} className="relative -mb-px ml-1 inline shrink-0" />
            </GlassCtaButton>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              className={cn(
                "-mr-1 flex shrink-0 items-center justify-center overflow-hidden rounded-full p-2 text-heading outline-none transition-colors duration-200 active:bg-slate-900/5 focus:outline-none focus-visible:outline-none sm:hidden",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={mobileOpen ? "close" : "open"}
                  initial={{ opacity: 0, rotate: -60, scale: 0.7 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 60, scale: 0.7 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="flex"
                >
                  {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                </motion.span>
              </AnimatePresence>
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
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[110] flex flex-col bg-white sm:hidden"
          >
            <div className="relative flex shrink-0 items-center justify-between border-b border-slate-100 px-4 pt-[26px] pb-2.5">
              <Link href="/" onClick={() => setMobileOpen(false)} className="ml-0.5 flex shrink-0 items-center">
                <Image
                  src="/verlab-studio-logo.png"
                  alt="Verlab Studio"
                  width={1200}
                  height={356}
                  sizes="160px"
                  className="h-9 w-auto"
                />
              </Link>
              <motion.button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                whileTap={{ scale: 0.88 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="-mr-1 flex shrink-0 items-center justify-center rounded-full p-2 text-slate-700 outline-none focus:outline-none focus-visible:outline-none"
              >
                <X size={22} />
              </motion.button>
            </div>

            <div className="relative flex flex-1 flex-col justify-center px-6">
              {NAV_LINKS.map((link, index) => (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={link.href}
                    onClick={(e) => {
                      handleNavLinkClick(e, link.href);
                      setMobileOpen(false);
                    }}
                    className="group flex items-center justify-between gap-4 border-b border-slate-100 py-5 transition-colors duration-200 active:bg-slate-50"
                  >
                    <span className="font-ui text-2xl font-semibold tracking-tight text-heading">{link.label}</span>
                    <ArrowUpRight
                      size={20}
                      strokeWidth={2.25}
                      className="shrink-0 text-slate-300 transition-all duration-300 ease-out group-active:translate-x-1 group-active:text-primary"
                    />
                  </Link>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + NAV_LINKS.length * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="relative shrink-0 border-t border-slate-100 p-4"
            >
              <GlassCtaButton
                href={APP_URL}
                onClick={() => setMobileOpen(false)}
                radius={12}
                icon={<Sparkle size={14} className="shrink-0 fill-current" />}
                className="w-full! justify-center px-4! py-3.5! text-base!"
              >
                Get Started
                <ArrowRight size={16} className="relative -mb-px ml-1 inline shrink-0" />
              </GlassCtaButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
