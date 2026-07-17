"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";

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
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        {!collapsed && "Collapse"}
      </button>
    </div>
  );
}
