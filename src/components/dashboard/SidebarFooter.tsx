"use client";

import { ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarFooter({
  collapsed,
  onToggleCollapse,
  onOpenSearch,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSearch: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="border-t border-hairline p-3">
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search"
        title={collapsed ? "Search" : undefined}
        className={cn(
          "mb-1 flex w-full cursor-pointer items-center gap-2 rounded-xl border border-hairline bg-app/60 px-3 py-2.5 text-sm font-medium text-subtle transition-all duration-150 hover:border-accent-line hover:bg-accent hover:text-heading",
          collapsed && "md:justify-center md:gap-0 md:px-0"
        )}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
            collapsed ? "md:max-w-0 md:opacity-0" : "flex-1 text-left md:max-w-[100px] md:opacity-100"
          )}
        >
          Search
        </span>
        {!collapsed && (
          <kbd className="hidden shrink-0 rounded-md border border-hairline bg-surface px-1.5 py-0.5 text-[10px] font-sans text-subtle md:inline-block">
            ⌘K
          </kbd>
        )}
      </button>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "hidden w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-subtle transition-colors duration-150 hover:bg-app hover:text-heading md:flex",
          collapsed && "md:justify-center"
        )}
      >
        {collapsed ? (
          <ChevronsRight className="h-4 w-4 shrink-0 transition-transform duration-300 ease-in-out" />
        ) : (
          <ChevronsLeft className="h-4 w-4 shrink-0 transition-transform duration-300 ease-in-out" />
        )}
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
            collapsed ? "max-w-0 opacity-0" : "max-w-[80px] opacity-100"
          )}
        >
          Collapse
        </span>
      </button>
    </div>
  );
}
