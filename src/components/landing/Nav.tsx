"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Sparkles, X } from "lucide-react";
import { LANDING_NAV_LINKS } from "@/lib/mock-data";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-3 z-50 px-3 sm:px-6">
      <div className="relative mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-xl bg-surface/70 shadow-card backdrop-blur-xl backdrop-saturate-150">
          <div className="flex h-16 items-center justify-between px-4 sm:px-5">
            <Link href="/" className="flex items-center">
              <Logo height={22} />
            </Link>

            <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-7 md:flex">
              {LANDING_NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-[14px] font-medium text-body transition-colors hover:text-primary"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <Button href="/app" variant="ghost" size="sm" className="px-4 py-2 text-[13px]">
                Log in
              </Button>
              <Button href="/app" size="sm" icon={Sparkles} className="px-4 py-2 text-[13px]">
                Get started
              </Button>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                aria-label="Toggle menu"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-body md:hidden"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {open && (
          <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-hairline bg-surface/95 p-4 shadow-card-hover backdrop-blur-xl md:hidden">
            <nav className="flex flex-col gap-3">
              {LANDING_NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-body hover:text-heading"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              <Button href="/app" variant="secondary" size="sm">
                Log in
              </Button>
              <Button href="/app" size="sm" icon={Sparkles}>
                Get started
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
