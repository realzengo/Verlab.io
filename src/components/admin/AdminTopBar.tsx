"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, User } from "lucide-react";
import { ADMIN_NAV, ADMIN_TEAM } from "@/lib/mock-data";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function heading(pathname: string): string {
  if (pathname === "/admin") return "Overview";
  const match = ADMIN_NAV.find((item) => item.href !== "/admin" && pathname.startsWith(item.href));
  return match?.label ?? "Admin";
}

export function AdminTopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const admin = ADMIN_TEAM[0];

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-6 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="shrink-0 rounded-lg p-1 text-body hover:bg-accent md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-xl font-semibold text-heading sm:text-2xl">{heading(pathname)}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-body sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          All systems operational
        </span>
        <ThemeToggle />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface p-1 pr-2"
            aria-label="Admin account menu"
          >
            <Avatar name={admin.name} size="sm" />
            <ChevronDown className="h-3.5 w-3.5 text-body" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-52 rounded-card-sm border border-hairline bg-surface p-1.5 shadow-card-hover">
              <div className="px-2.5 py-2">
                <p className="text-sm font-semibold text-heading">{admin.name}</p>
                <p className="text-xs text-body">{admin.email}</p>
              </div>
              <div className="my-1 border-t border-hairline" />
              <Link href="/app" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-heading hover:bg-accent">
                <User className="h-4 w-4 text-body" />
                Exit to app
              </Link>
              <Link href="/" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-heading hover:bg-accent">
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
