"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { ADMIN_NAV_SECTIONS } from "@/lib/mock/nav";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const rowBase =
  "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] leading-none transition-colors";

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
    // The rail shares the canvas with the page; a hairline is its only edge.
    // The active row is lifted onto the card surface -- the same material as
    // the content it opens -- rather than painted in the accent.
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-screen w-60 flex-col border-r border-hairline bg-app transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 md:shrink-0 md:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "md:w-[64px]" : "md:w-60"
      )}
    >
      <div className={cn("flex h-14 shrink-0 items-center justify-between px-4", collapsed && "md:justify-center md:px-0")}>
        <span className={cn("relative block h-8 w-[118px]", collapsed && "md:hidden")}>
          <Image src="/admin-logo.png" alt="Verlab Admin" fill className="object-contain object-left dark:hidden" sizes="118px" priority />
          {/* Same artwork with the wordmark in white, for the dark canvas. */}
          <Image src="/admin-logo-dark.png" alt="Verlab Admin" fill className="hidden object-contain object-left dark:block" sizes="118px" priority />
        </span>
        <span className={cn("relative hidden h-8 w-8 overflow-hidden", collapsed && "md:block")}>
          <Image src="/admin-logo.png" alt="Verlab Admin" fill className="object-cover object-left" sizes="32px" />
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="shrink-0 rounded-md p-1 text-subtle transition-colors hover:bg-(--admin-fill) hover:text-heading md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav aria-label="Admin" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-2">
        {ADMIN_NAV_SECTIONS.map((section) => (
          <div key={section.label ?? "root"} className="flex flex-col gap-0.5">
            {section.label && (
              <p className={cn("mb-1 px-2.5 text-[11px] font-medium text-subtle", collapsed && "md:sr-only")}>
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    rowBase,
                    collapsed && "md:justify-center md:px-0",
                    active
                      ? "bg-surface font-medium text-heading shadow-[0_1px_2px_rgba(16,16,24,0.06),0_0_0_1px_var(--color-hairline)] dark:bg-(--admin-fill-strong) dark:shadow-none"
                      : "text-body hover:bg-(--admin-fill) hover:text-heading"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-primary" : "text-subtle group-hover:text-body"
                    )}
                    aria-hidden="true"
                  />
                  <span className={cn("truncate", collapsed && "md:hidden")}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex shrink-0 flex-col gap-0.5 border-t border-hairline p-3">
        <Link
          href="/"
          onClick={onCloseMobile}
          title={collapsed ? "Exit to app" : undefined}
          className={cn(rowBase, "text-body hover:bg-(--admin-fill) hover:text-heading", collapsed && "md:justify-center md:px-0")}
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-subtle group-hover:text-body" aria-hidden="true" />
          <span className={cn(collapsed && "md:hidden")}>Exit to app</span>
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : undefined}
          className={cn(
            rowBase,
            "hidden w-full cursor-pointer text-body hover:bg-(--admin-fill) hover:text-heading md:flex",
            collapsed && "md:justify-center md:px-0"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0 text-subtle group-hover:text-body" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0 text-subtle group-hover:text-body" aria-hidden="true" />
          )}
          <span className={cn(collapsed && "md:hidden")}>Collapse</span>
        </button>

        <div className={cn("mt-2 flex items-center gap-2.5 px-1.5", collapsed && "md:justify-center md:px-0")}>
          <Avatar name={email || "Admin"} size="sm" />
          <p className={cn("min-w-0 flex-1 truncate text-[12px] font-medium text-body", collapsed && "md:hidden")}>
            {email || "Admin"}
          </p>
        </div>
      </div>
    </aside>
  );
}
