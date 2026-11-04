"use client";

import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
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
  const hideLabel = collapsed ? "lg:max-w-0 lg:opacity-0" : "lg:max-w-[120px] lg:opacity-100";

  return (
    <div className={cn("flex flex-col gap-1 border-t border-hairline p-3", collapsed && "lg:px-2.5")}>
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search"
        title={collapsed ? "Search" : undefined}
        className={cn(
          "font-ui flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-subtle transition-colors hover:text-heading dark:bg-white/[0.03]",
          collapsed && "lg:justify-center lg:gap-0 lg:px-0"
        )}
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={cn("overflow-hidden whitespace-nowrap text-left transition-all duration-300 ease-in-out", hideLabel, !collapsed && "flex-1")}>
          Search
        </span>
        {!collapsed && (
          <kbd className="ml-auto hidden shrink-0 rounded border border-hairline bg-app px-1.5 py-px font-sans text-[10px] text-subtle lg:inline-block">
            ⌘K
          </kbd>
        )}
      </button>

      {/* Only admins see this; a plain row like the rest of the rail, so the
          one privileged link doesn't outshout every tool above it. */}
      {isAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          aria-label="Admin dashboard"
          title={collapsed ? "Admin" : undefined}
          className={cn(
            "font-ui group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[14px] font-medium text-body transition-colors hover:bg-(--app-fill) hover:text-heading",
            collapsed && "lg:justify-center lg:gap-0 lg:px-0"
          )}
        >
          <ShieldCheck className="h-[18px] w-[18px] shrink-0 text-subtle group-hover:text-body" aria-hidden="true" />
          <span className={cn("overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out", hideLabel)}>Admin</span>
        </Link>
      )}
    </div>
  );
}
