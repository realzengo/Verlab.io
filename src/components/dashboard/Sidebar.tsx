"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { Logo } from "@/components/ui/Logo";
import { SidebarFooter } from "@/components/dashboard/SidebarFooter";
import { cn } from "@/lib/utils";

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-hairline bg-surface transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 md:shrink-0 md:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "md:w-[76px]" : "md:w-64"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-4 py-5",
          collapsed && "md:justify-center md:px-0"
        )}
      >
        <Logo height={collapsed ? 16 : 22} />
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
        {SIDEBAR_NAV.map((item) => {
          const active = pathname === item.href;
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

      <SidebarFooter
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        onNavigate={onCloseMobile}
      />
    </aside>
  );
}
