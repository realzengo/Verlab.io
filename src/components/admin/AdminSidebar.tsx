"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { ADMIN_NAV } from "@/lib/mock-data";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function AdminSidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const [email, setEmail] = useState("");

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  return (
    // Sits on the warm paper canvas with a hairline edge -- the rail is
    // separated from content by figure/ground, not by elevation.
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-hairline bg-app transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 md:shrink-0 md:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "md:w-[76px]" : "md:w-64"
      )}
    >
      <div className={cn("flex items-center justify-between px-5 py-6", collapsed && "md:justify-center md:px-0")}>
        <span className={cn("relative block h-10 w-[135px]", collapsed && "md:hidden")}>
          <Image src="/admin-logo.png" alt="Verlab Admin" fill className="object-contain object-left" sizes="135px" />
        </span>
        <span className={cn("relative hidden h-10 w-10", collapsed && "md:block")}>
          <Image src="/admin-logo.png" alt="Verlab Admin" fill className="object-cover object-left" sizes="40px" />
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="shrink-0 text-subtle transition-colors hover:text-heading md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ex-app-shell-row: body-sm rows at a tight 5px radius, with the brand
          blue as the active indicator -- the one structural accent. */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        {ADMIN_NAV.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-[5px] px-4 py-2.5 text-[15px] leading-[1.33] transition-colors",
                collapsed && "md:justify-center md:px-0",
                active
                  ? "bg-accent font-medium text-primary"
                  : "font-normal text-body hover:bg-black/[0.035] hover:text-heading dark:hover:bg-white/[0.05]"
              )}
              title={collapsed ? item.label : undefined}
            >
              {/* Active glyph inherits the row's color so it tracks the AA-safe
                  pressed blue applied to accent-tinted plates in globals.css. */}
              <item.icon className={cn("h-[18px] w-[18px] shrink-0", !active && "text-subtle")} />
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
          className="mb-2 hidden w-full cursor-pointer items-center justify-center gap-2 rounded-[5px] py-2 text-sm font-medium text-subtle transition-colors hover:text-heading md:flex"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && "Collapse"}
        </button>

        <Link
          href="/"
          onClick={onCloseMobile}
          className={cn(
            "mb-2 flex items-center gap-3 rounded-[5px] px-4 py-2.5 text-[15px] leading-[1.33] text-body transition-colors hover:bg-black/[0.035] hover:text-heading dark:hover:bg-white/[0.05]",
            collapsed && "md:justify-center md:px-0"
          )}
        >
          <ArrowLeft className="h-[18px] w-[18px] shrink-0 text-subtle" />
          <span className={cn(collapsed && "md:hidden")}>Exit to app</span>
        </Link>

        <div className={cn("flex items-center gap-2.5 rounded-[5px] px-2 py-1.5", collapsed && "md:justify-center md:px-0")}>
          <Avatar name={email || "Admin"} size="sm" />
          <div className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
            <p className="truncate text-xs font-medium text-body">{email || "Admin"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
