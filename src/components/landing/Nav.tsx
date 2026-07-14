"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Wand2, X } from "lucide-react";
import { LANDING_NAV_LINKS } from "@/lib/mock-data";
import { Button } from "@/components/ui/Button";

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-chip bg-primary text-white">
            <Wand2 className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold text-heading">Clypa</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {LANDING_NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="text-sm font-medium text-body hover:text-heading">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button href="/app" variant="ghost" size="sm">
            Log in
          </Button>
          <Button href="/app" size="sm">
            Get started free
          </Button>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-hairline bg-white px-4 py-4 md:hidden">
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
            <Button href="/app" size="sm">
              Get started free
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
