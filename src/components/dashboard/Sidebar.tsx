"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, PanelLeftClose, X } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { SidebarFooter } from "@/components/dashboard/SidebarFooter";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { railFade, useSidebarCollapsed } from "@/components/dashboard/SidebarCollapsedContext";
import { cn } from "@/lib/utils";

// One row recipe for every link in the rail. The active row is lifted onto
// the card surface -- the same material as the page it opens -- instead of
// being painted in the accent; the accent is left to its icon. Padding never
// changes with the rail, so every icon holds one axis while it opens/closes.
const ROW = "font-ui group flex h-9 items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-[14px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40";
const ROW_ACTIVE =
  "bg-surface text-heading shadow-[0_1px_2px_rgba(16,24,40,0.06),0_0_0_1px_var(--color-hairline)] dark:bg-white/[0.07] dark:shadow-none";
const ROW_IDLE = "text-body hover:bg-(--app-fill) hover:text-heading";
const ICON = "h-[18px] w-[18px] shrink-0 transition-colors";

export function Sidebar({
  mobileOpen,
  onCloseMobile,
  isAdmin,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isAdmin: boolean;
}) {
  const { collapsed, setCollapsed } = useSidebarCollapsed();
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [popoverGroup, setPopoverGroup] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popoverGroup) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const trigger = triggerRefs.current[popoverGroup];
      if (popoverRef.current?.contains(target) || trigger?.contains(target)) return;
      setPopoverGroup(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popoverGroup]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => (prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]));
  };

  const togglePopover = (label: string) => {
    if (popoverGroup === label) {
      setPopoverGroup(null);
      return;
    }
    const el = triggerRefs.current[label];
    if (el) {
      const rect = el.getBoundingClientRect();
      setPopoverPos({ top: rect.top, left: rect.right + 8 });
    }
    setPopoverGroup(label);
  };

  const label = (text: string) => <span className={railFade(collapsed)}>{text}</span>;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 isolate flex h-screen w-60 flex-col border-r border-hairline bg-app transition-transform duration-300 ease-in-out dark:bg-[#09090b] lg:sticky lg:top-0 lg:translate-x-0 lg:shrink-0 lg:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "lg:w-16" : "lg:w-60"
      )}
    >
      {/* One wordmark image in both states: collapsing narrows its clip box to
          the mark (37px of the 122px-wide, 36px-tall logo), so the text slides
          away and the "V" never swaps or moves. The mark's centre sits ~19px
          into the image, so -ml-[3px] off the 15px gutter puts it on the nav
          icons' axis. */}
      <div className="relative flex h-16 shrink-0 items-center justify-between px-[15px]">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="group hidden items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:flex"
        >
          <span
            className={cn(
              "relative -ml-[3px] block h-9 shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
              collapsed ? "w-[37px]" : "w-[122px]"
            )}
          >
            <Image
              src="/logo-full-light.png"
              alt="Verlab Studio"
              width={600}
              height={178}
              priority
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              className={cn(
                "absolute left-0 top-0 h-9 w-auto max-w-none transition-opacity duration-200 ease-in-out dark:hidden",
                collapsed && "group-hover:opacity-0"
              )}
            />
            <Image
              src="/logo-full-dark.png"
              alt="Verlab Studio"
              width={600}
              height={178}
              priority
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              className={cn(
                "absolute left-0 top-0 hidden h-9 w-auto max-w-none transition-opacity duration-200 ease-in-out dark:block",
                collapsed && "group-hover:opacity-0"
              )}
            />
            {collapsed && (
              <span
                aria-hidden="true"
                className="absolute left-0.5 top-px flex h-[34px] w-[34px] scale-90 items-center justify-center rounded-lg border border-hairline bg-surface opacity-0 transition-all duration-200 ease-out group-hover:scale-100 group-hover:opacity-100"
              >
                <ChevronRight className="h-4 w-4 text-subtle" />
              </span>
            )}
          </span>
        </button>
        <span className="relative -ml-[3px] block h-9 w-[122px] overflow-hidden lg:hidden">
          <Image
            src="/logo-full-light.png"
            alt="Verlab Studio"
            width={600}
            height={178}
            draggable={false}
            onContextMenu={(event) => event.preventDefault()}
            className="h-9 w-auto max-w-none dark:hidden"
          />
          <Image
            src="/logo-full-dark.png"
            alt="Verlab Studio"
            width={600}
            height={178}
            draggable={false}
            onContextMenu={(event) => event.preventDefault()}
            className="hidden h-9 w-auto max-w-none dark:block"
          />
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="rounded-md p-1 text-subtle transition-colors hover:bg-(--app-fill) hover:text-heading lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
        <span
          inert={collapsed}
          className={cn("absolute right-3 top-1/2 hidden -translate-y-1/2 lg:block", railFade(collapsed), collapsed && "pointer-events-none")}
        >
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-subtle transition-colors hover:bg-(--app-fill) hover:text-heading"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </span>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-3 pt-2">
        {SIDEBAR_NAV.map((item) => {
          if (!item.subItems) {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(ROW, active ? ROW_ACTIVE : ROW_IDLE)}
              >
                <item.icon
                  className={cn(ICON, active ? "text-primary dark:text-white" : "text-subtle group-hover:text-body")}
                  aria-hidden="true"
                />
                {label(item.label)}
              </Link>
            );
          }

          const isOpen = openGroups.includes(item.label);
          const groupActive = item.subItems.some((subItem) => pathname === subItem.href);
          const popoverOpen = collapsed && popoverGroup === item.label && popoverPos !== null;

          return (
            <div key={item.label}>
              <button
                type="button"
                ref={(el) => {
                  triggerRefs.current[item.label] = el;
                }}
                onClick={() => (collapsed ? togglePopover(item.label) : toggleGroup(item.label))}
                aria-expanded={collapsed ? popoverOpen : isOpen}
                title={collapsed ? item.label : undefined}
                className={cn(ROW, "w-full cursor-pointer justify-between", groupActive ? "text-heading" : ROW_IDLE)}
              >
                <span className="flex items-center gap-2.5">
                  <item.icon
                    className={cn(ICON, groupActive ? "text-primary" : "text-subtle group-hover:text-body")}
                    aria-hidden="true"
                  />
                  {label(item.label)}
                </span>
                <span className={cn("flex shrink-0", railFade(collapsed))}>
                  <ChevronDown
                    className={cn("h-4 w-4 text-subtle transition-transform duration-300 ease-in-out", !isOpen && "-rotate-90")}
                  />
                </span>
              </button>

              {!collapsed && (
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="ml-[19px] flex flex-col gap-0.5 border-l border-hairline py-1 pl-3">
                      {item.subItems.map((subItem) => {
                        const active = pathname === subItem.href;
                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            onClick={onCloseMobile}
                            aria-current={active ? "page" : undefined}
                            className={cn(ROW, "h-8 text-[13px]", active ? ROW_ACTIVE : ROW_IDLE)}
                          >
                            <subItem.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-subtle")} />
                            <span className="truncate">{subItem.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {popoverOpen &&
                popoverPos &&
                createPortal(
                  <div
                    ref={popoverRef}
                    style={{ position: "fixed", top: popoverPos.top, left: popoverPos.left }}
                    className="z-50 flex w-56 flex-col gap-0.5 rounded-xl border border-hairline bg-surface p-1.5 shadow-card-hover"
                  >
                    <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-subtle">{item.label}</p>
                    {item.subItems.map((subItem) => {
                      const active = pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={() => {
                            onCloseMobile();
                            setPopoverGroup(null);
                          }}
                          aria-current={active ? "page" : undefined}
                          className={cn(ROW, "h-8 text-[13px]", active ? "bg-(--app-fill-strong) text-heading" : ROW_IDLE)}
                        >
                          <subItem.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-subtle")} />
                          <span className="truncate">{subItem.title}</span>
                        </Link>
                      );
                    })}
                  </div>,
                  document.body
                )}
            </div>
          );
        })}
      </nav>

      <SidebarFooter
        collapsed={collapsed}
        isAdmin={isAdmin}
        onOpenSearch={() => setSearchOpen(true)}
        onNavigate={onCloseMobile}
      />

      {searchOpen && createPortal(<CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />, document.body)}
    </aside>
  );
}
