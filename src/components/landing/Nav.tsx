"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Zap } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Affiliates", href: "/affiliates" },
];

const CTA_CLASSES =
  "inline-flex items-center gap-2 rounded-full bg-btn-primary px-6 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:bg-btn-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed top-0 z-50 w-full bg-surface/80 backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: logo */}
        <Link href="/" className="flex items-center">
          <Logo height={22} />
        </Link>

        {/* Center: Features + Pricing + Affiliates, grouped and truly centered */}
        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`text-base font-semibold hover:text-primary ${
                pathname === link.href ? "text-primary" : "text-heading"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: primary CTA only */}
        <div className="hidden md:flex">
          <Link href="/app" className={CTA_CLASSES}>
            <Zap className="h-4 w-4" />
            Try Clypo
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-heading md:hidden"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="bg-surface/80 px-4 py-4 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-sm font-medium text-heading hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
            <Link href="/app" onClick={() => setMobileOpen(false)} className={`${CTA_CLASSES} mt-2 justify-center`}>
              <Zap className="h-4 w-4" />
              Try Clypo
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
