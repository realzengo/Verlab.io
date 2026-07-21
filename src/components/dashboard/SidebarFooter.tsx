"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarFooter({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="border-t border-hairline p-3">
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden md:flex items-center justify-center w-full gap-2 text-sm font-medium text-body hover:text-heading cursor-pointer"
      >
        {collapsed ? (
          <ChevronsRight className="h-4 w-4 transition-transform duration-300 ease-in-out" />
        ) : (
          <ChevronsLeft className="h-4 w-4 transition-transform duration-300 ease-in-out" />
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
