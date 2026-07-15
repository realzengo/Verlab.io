"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronsLeft, ChevronsRight, ShieldCheck, X } from "lucide-react";
import { ADMIN_NAV, ADMIN_TEAM } from "@/lib/mock-data";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export function AdminSidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const admin = ADMIN_TEAM[0];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-hairline bg-surface transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 md:shrink-0 md:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "md:w-[76px]" : "md:w-64"
      )}
    >
      <div className={cn("flex items-center justify-between px-4 py-5", collapsed && "md:justify-center md:px-0")}>
        <div className={cn("flex items-center gap-2", collapsed && "md:hidden")}>
          <Logo height={18} />
          <span className="flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-white/10">
            <ShieldCheck className="h-3 w-3" />
            Admin
          </span>
        </div>
        <ShieldCheck className={cn("hidden h-5 w-5 text-primary", collapsed && "md:block")} />
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="text-subtle hover:text-body md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {ADMIN_NAV.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && "md:justify-center md:px-0",
                active ? "bg-accent text-primary" : "text-body hover:bg-app hover:text-heading"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-hairline p-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mb-3 hidden w-full cursor-pointer items-center justify-center gap-2 text-sm font-medium text-body hover:text-heading md:flex"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && "Collapse"}
        </button>

        <Link
          href="/app"
          onClick={onCloseMobile}
          className={cn(
            "mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-body transition-colors hover:bg-app hover:text-heading",
            collapsed && "md:justify-center md:px-0"
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className={cn(collapsed && "md:hidden")}>Exit to app</span>
        </Link>

        <div className={cn("flex items-center gap-2.5 rounded-xl px-2 py-1.5", collapsed && "md:justify-center md:px-0")}>
          <Avatar name={admin.name} size="sm" />
          <div className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
            <p className="truncate text-xs font-semibold text-heading">{admin.name}</p>
            <p className="truncate text-[10px] uppercase tracking-wide text-subtle">{admin.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
