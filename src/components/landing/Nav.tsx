"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Sparkles, Wand2, X } from "lucide-react";
import { LANDING_NAV_LINKS } from "@/lib/mock-data";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-surface/82 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-primary text-white">
            <Wand2 className="h-4 w-4" />
          </span>
          <span className="text-[22px] font-extrabold tracking-tight text-heading">
            <span className="text-primary">C</span>lypa
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LANDING_NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="text-[15px] font-medium text-body hover:text-heading">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3.5 md:flex">
          <ThemeToggle />
          <Button href="/app" variant="ghost" size="sm" className="px-4.5 py-2.5 text-[13px]">
            Log in
          </Button>
          <Button href="/app" size="sm" icon={Sparkles} className="px-4.5 py-2.5 text-[13px]">
            Get started free
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Toggle menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-hairline bg-surface px-4 py-4 md:hidden">
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
              Get started free
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
