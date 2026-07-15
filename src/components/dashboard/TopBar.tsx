"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CreditCard, LogOut, Settings } from "lucide-react";
import { MOCK_USER, SIDEBAR_NAV } from "@/lib/mock-data";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function defaultHeading(pathname: string): string {
  if (pathname === "/app") return `Welcome back, ${MOCK_USER.name} 👋`;
  const match = SIDEBAR_NAV.find((item) => pathname.startsWith(item.href) && item.href !== "/app");
  if (match) return match.label;
  if (pathname.startsWith("/app/settings")) return "Settings";
  return "Clypa";
}

export function TopBar({ heading }: { heading?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const resolvedHeading = heading ?? defaultHeading(pathname);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-6 sm:px-8">
      <h1 className="text-xl font-semibold text-heading sm:text-2xl">{resolvedHeading}</h1>

      <div className="flex shrink-0 items-center gap-3">
        <ThemeToggle />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface p-1 pr-2"
            aria-label="Account menu"
          >
            <Avatar name={MOCK_USER.name} size="sm" />
            <ChevronDown className="h-3.5 w-3.5 text-body" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-52 rounded-card-sm border border-hairline bg-surface p-1.5 shadow-card-hover">
              <div className="px-2.5 py-2">
                <p className="text-sm font-semibold text-heading">{MOCK_USER.name}</p>
                <p className="text-xs text-body">{MOCK_USER.email}</p>
              </div>
              <div className="my-1 border-t border-hairline" />
              <Link
                href="/app/settings"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-heading hover:bg-accent"
              >
                <Settings className="h-4 w-4 text-body" />
                Settings
              </Link>
              <Link
                href="/app/settings"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-heading hover:bg-accent"
              >
                <CreditCard className="h-4 w-4 text-body" />
                Billing
              </Link>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-heading hover:bg-accent"
              >
                <LogOut className="h-4 w-4 text-body" />
                Log out
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
