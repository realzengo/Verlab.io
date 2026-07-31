"use client";

import Link from "next/link";
import { Crown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarFooter({
  collapsed,
  isAdmin,
  onOpenSearch,
  onNavigate,
}: {
  collapsed: boolean;
  isAdmin: boolean;
  onOpenSearch: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="p-3">
      {isAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          aria-label="Admin dashboard"
          title={collapsed ? "Admin" : undefined}
          className={cn(
            "admin-king-btn mb-1 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold",
            collapsed && "lg:justify-center lg:gap-0 lg:px-0"
          )}
        >
          <span
            aria-hidden="true"
            className="admin-king-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 blur-sm"
          />
          <Crown
            className="h-4 w-4 shrink-0 text-[#92650c] dark:text-[#f5c518] dark:drop-shadow-[0_0_6px_rgba(234,179,8,0.55)]"
            strokeWidth={2.25}
          />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap bg-gradient-to-b from-[#92650c] to-[#b45309] bg-clip-text text-transparent transition-all duration-300 ease-in-out dark:from-[#fde68a] dark:to-[#eab308]",
              collapsed ? "lg:max-w-0 lg:opacity-0" : "flex-1 text-left lg:max-w-[100px] lg:opacity-100"
            )}
          >
            Admin
          </span>
        </Link>
      )}
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search"
        title={collapsed ? "Search" : undefined}
        className={cn(
          "mb-1 flex w-full cursor-pointer items-center gap-2 rounded-xl border border-hairline bg-app dark:bg-app/60 px-3 py-2.5 text-sm font-medium text-subtle transition-all duration-150 hover:border-accent-line hover:bg-accent hover:text-heading",
          collapsed && "lg:justify-center lg:gap-0 lg:px-0"
        )}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
            collapsed ? "lg:max-w-0 lg:opacity-0" : "flex-1 text-left lg:max-w-[100px] lg:opacity-100"
          )}
        >
          Search
        </span>
        {!collapsed && (
          <kbd className="hidden shrink-0 rounded-md border border-hairline bg-surface px-1.5 py-0.5 text-[10px] font-sans text-subtle lg:inline-block">
            ⌘K
          </kbd>
        )}
      </button>
    </div>
  );
}
