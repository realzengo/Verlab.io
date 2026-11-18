"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { AdminPulseCard, AdminPulseDot, useAdminPulse } from "@/components/admin/AdminPulseCard";
import { ADMIN_NAV_SECTIONS } from "@/lib/mock/nav";
import { cn } from "@/lib/utils";

const rowBase =
  "group relative flex h-9 items-center gap-3 rounded-[10px] px-3 text-[14px] leading-none transition-colors duration-150";

const iconButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-(--admin-fill-strong) hover:text-heading";

function isActive(href: string, pathname: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebar({
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  // Where the active pill sits; null until measured, so it never animates in
  // from the top of the list on first paint.
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  const [pillMoves, setPillMoves] = useState(false);
  const pulse = useAdminPulse();

  // One raised pill glides to whichever row is active, instead of each row
  // painting its own background.
  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    setPill(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
  }, [pathname, collapsed]);

  useEffect(() => {
    if (!pill || pillMoves) return;
    const frame = requestAnimationFrame(() => setPillMoves(true));
    return () => cancelAnimationFrame(frame);
  }, [pill, pillMoves]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col border-r border-hairline bg-(--admin-sidebar) transition-transform md:bg-(--admin-sidebar-desktop) duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 md:shrink-0 md:transition-[width]",
        mobileOpen ? "translate-x-0 shadow-elevated" : "-translate-x-full",
        collapsed ? "md:w-[72px]" : "md:w-64"
      )}
    >
      <div className={cn("flex h-[72px] shrink-0 items-center justify-between pl-5 pr-3", collapsed && "md:justify-center md:px-0")}>
        <Link href="/admin" onClick={onCloseMobile} aria-label="Admin overview" className={cn("relative block h-9 w-[134px]", collapsed && "md:hidden")}>
          <Image src="/admin-logo.png" alt="Verlab Admin" fill className="object-contain object-left dark:hidden" sizes="134px" priority />
          {/* Same artwork with the wordmark in white, for the dark canvas. */}
          <Image src="/admin-logo-dark.png" alt="" fill className="hidden object-contain object-left dark:block" sizes="134px" priority />
        </Link>
        <Link href="/admin" aria-label="Admin overview" className={cn("relative hidden h-9 w-9 overflow-hidden", collapsed && "md:block")}>
          <Image src="/admin-logo.png" alt="" fill className="object-cover object-left" sizes="36px" />
        </Link>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className={cn(iconButton, "hidden md:flex", collapsed && "md:hidden")}
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
        <button type="button" onClick={onCloseMobile} aria-label="Close menu" className={cn(iconButton, "md:hidden")}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 pb-4 pt-1">
        <div ref={listRef} className="relative flex flex-col gap-6">
          {pill && (
            <span
              aria-hidden="true"
              className={cn(
                "admin-nav-pill pointer-events-none absolute inset-x-0 top-0 rounded-[10px] bg-surface shadow-[0_0_0_1px_var(--color-hairline),0_1px_2px_rgba(10,10,30,0.06),0_2px_8px_-2px_rgba(10,10,30,0.06)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05))] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.13),inset_0_1px_0_rgba(255,255,255,0.06)]",
                !pillMoves && "transition-none!"
              )}
              style={{ transform: `translateY(${pill.top}px)`, height: pill.height }}
            />
          )}

          {ADMIN_NAV_SECTIONS.map((section) => (
            <div key={section.label ?? "root"} className="flex flex-col gap-1">
              {section.label && (
                <p className={cn("mb-1 px-3 text-[12px] font-medium text-subtle", collapsed && "md:sr-only")}>{section.label}</p>
              )}
              {section.items.map((item) => {
                const active = isActive(item.href, pathname);
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
                      active ? "font-medium text-heading" : "text-body hover:bg-(--admin-fill) hover:text-heading"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "relative h-[18px] w-[18px] shrink-0 transition-colors",
                        active ? "text-heading" : "text-subtle group-hover:text-body"
                      )}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className={cn("relative truncate", collapsed && "md:hidden")}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      <div className="shrink-0 p-3">
        {/* Expanded: how the app is doing -- problems first, then growth. */}
        <div className={cn(collapsed && "md:hidden")}>
          <AdminPulseCard state={pulse} onNavigate={onCloseMobile} />
          <Link
            href="/"
            onClick={onCloseMobile}
            className="group mt-1.5 flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] text-subtle transition-colors hover:text-heading"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
            Back to Verlab
          </Link>
        </div>

        {/* Collapsed: the status as a dot, and the ways out as icons. */}
        <div className={cn("hidden flex-col items-center gap-1", collapsed && "md:flex")}>
          <AdminPulseDot state={pulse} />
          <button type="button" onClick={onToggleCollapsed} aria-label="Expand sidebar" title="Expand sidebar" className={iconButton}>
            <PanelLeftOpen className="h-4 w-4" />
          </button>
          <Link href="/" aria-label="Back to Verlab" title="Back to Verlab" className={iconButton}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
