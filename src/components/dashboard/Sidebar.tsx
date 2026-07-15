"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-hairline bg-surface transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div className={cn("flex items-center px-4 py-5", collapsed && "justify-center px-0")}>
        <Logo height={collapsed ? 16 : 22} />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {SIDEBAR_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active ? "bg-accent text-primary" : "text-body hover:bg-app hover:text-heading"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 border-t border-hairline p-3">
        {collapsed ? (
          <button
            type="button"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center self-center rounded-lg border border-hairline text-body hover:text-heading"
          >
            <Search className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            className="flex items-center justify-between gap-2 rounded-lg border border-hairline px-3 py-2 text-sm text-body hover:text-heading"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search
            </span>
            <span className="rounded border border-hairline bg-app px-1.5 py-0.5 text-[10px] font-semibold text-body">
              ⌘K
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-body hover:bg-app hover:text-heading"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
