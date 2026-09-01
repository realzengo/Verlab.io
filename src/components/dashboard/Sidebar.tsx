"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { SidebarFooter } from "@/components/dashboard/SidebarFooter";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { useSidebarCollapsed } from "@/components/dashboard/SidebarCollapsedContext";
import { cn } from "@/lib/utils";

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
  const asideRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [hoverIndicator, setHoverIndicator] = useState<{ top: number; height: number } | null>(null);

  const showHoverIndicator = useCallback((el: HTMLElement | null) => {
    if (!el || !asideRef.current) return;
    const itemRect = el.getBoundingClientRect();
    const asideRect = asideRef.current.getBoundingClientRect();
    setHoverIndicator({ top: itemRect.top - asideRect.top, height: itemRect.height });
  }, []);

  const getActiveKey = useCallback(() => {
    for (const item of SIDEBAR_NAV) {
      if (!item.subItems) {
        if (pathname === item.href) return item.href;
      } else if (item.subItems.some((subItem) => pathname === subItem.href)) {
        return item.label;
      }
    }
    return null;
  }, [pathname]);

  const syncIndicatorToActive = useCallback(() => {
    const key = getActiveKey();
    if (!key) {
      setHoverIndicator(null);
      return;
    }
    showHoverIndicator(itemRefs.current[key] ?? null);
  }, [getActiveKey, showHoverIndicator]);

  useEffect(() => {
    // Measures DOM layout (an external system) to reposition the indicator after navigation/collapse.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncIndicatorToActive();
  }, [syncIndicatorToActive, collapsed]);

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
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
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

  return (
    <aside
      ref={asideRef}
      className={cn(
        "fixed inset-y-0 left-0 z-50 isolate flex h-screen w-64 flex-col border-r border-[#E0E4F2] bg-[#FCFCFD] transition-transform duration-300 ease-in-out dark:border-white/5 dark:bg-black/50 dark:backdrop-blur-2xl dark:backdrop-saturate-150 lg:sticky lg:top-0 lg:translate-x-0 lg:shrink-0 lg:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "lg:w-[76px]" : "lg:w-64"
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 w-1.5 rounded-r-full bg-primary dark:bg-white transition-all duration-200 ease-out"
        style={{
          top: hoverIndicator ? hoverIndicator.top + 6 : 0,
          height: hoverIndicator ? hoverIndicator.height - 12 : 0,
          opacity: hoverIndicator ? 1 : 0,
        }}
      />
      <div
        className={cn(
          "flex items-center justify-between px-4 py-5",
          collapsed && "lg:justify-center lg:px-0"
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="group hidden items-center outline-none focus-visible:outline-none lg:flex"
        >
          <span
            className={cn(
              "relative block h-10 shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
              collapsed ? "w-10" : "w-[136px]"
            )}
          >
            <Image
              src="/logo-icon.png"
              alt="Verlab Studio"
              width={160}
              height={160}
              priority
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              className={cn(
                "absolute left-0 top-0 h-10 w-10 object-contain transition-opacity duration-200 ease-in-out",
                collapsed ? "opacity-100 group-hover:opacity-0" : "opacity-0"
              )}
            />
            {collapsed && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 flex h-10 w-10 scale-90 items-center justify-center rounded-xl border border-hairline bg-surface opacity-0 shadow-sm transition-all duration-200 ease-out group-hover:scale-100 group-hover:opacity-100"
              >
                <ChevronRight className="h-4 w-4 text-subtle transition-colors duration-200 ease-out group-hover:text-heading" />
              </span>
            )}
            <Image
              src="/logo-full-light.png"
              alt="Verlab Studio"
              width={600}
              height={178}
              priority
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              className={cn(
                "absolute left-0 top-0 h-10 w-auto max-w-none transition-opacity duration-200 ease-in-out dark:hidden",
                collapsed ? "opacity-0" : "opacity-100"
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
                "absolute left-0 top-0 hidden h-10 w-auto max-w-none transition-opacity duration-200 ease-in-out dark:block",
                collapsed ? "opacity-0" : "opacity-100"
              )}
            />
          </span>
        </button>
        <div className="flex items-center lg:hidden">
          <span className="relative block h-10 w-[136px] overflow-hidden">
            <Image
              src="/logo-full-light.png"
              alt="Verlab Studio"
              width={600}
              height={178}
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              className="h-10 w-auto max-w-none dark:hidden"
            />
            <Image
              src="/logo-full-dark.png"
              alt="Verlab Studio"
              width={600}
              height={178}
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              className="hidden h-10 w-auto max-w-none dark:block"
            />
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="text-subtle hover:text-body lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="hidden h-7 w-7 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-app hover:text-heading lg:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-3"
        onMouseLeave={syncIndicatorToActive}
      >
        {SIDEBAR_NAV.map((item) => {
          if (!item.subItems) {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => {
                  itemRefs.current[item.href] = el;
                }}
                onClick={onCloseMobile}
                onMouseEnter={(e) => showHoverIndicator(e.currentTarget)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "font-ui group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[15px] font-semibold outline-none transition-all duration-150 focus:outline-none focus-visible:outline-none",
                  collapsed && "lg:justify-center lg:gap-0 lg:px-0",
                  active
                    ? "border-[#E0E4F2] bg-surface font-semibold text-heading shadow-card dark:border-0 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.09),inset_0_-1px_0_0_rgba(0,0,0,0.55)]"
                    : "border-transparent text-[#434C69] hover:bg-accent hover:text-heading"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    active ? "text-primary dark:text-white" : "text-[#A1AAC8] group-hover:text-primary"
                  )}
                />
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                    collapsed ? "lg:max-w-0 lg:opacity-0" : "lg:max-w-[160px] lg:opacity-100"
                  )}
                >
                  {item.label}
                </span>
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
                  itemRefs.current[item.label] = el;
                }}
                onClick={() => (collapsed ? togglePopover(item.label) : toggleGroup(item.label))}
                onMouseEnter={(e) => showHoverIndicator(e.currentTarget)}
                aria-expanded={collapsed ? popoverOpen : isOpen}
                className={cn(
                  "font-ui group flex w-full cursor-pointer items-center justify-between rounded-xl border border-transparent px-3 py-2.5 text-[15px] font-semibold transition-all duration-150",
                  collapsed && "lg:justify-center lg:px-0",
                  groupActive
                    ? "text-heading"
                    : "text-[#434C69] hover:bg-accent hover:text-heading"
                )}
                title={collapsed ? item.label : undefined}
              >
                <span className={cn("flex items-center gap-3", collapsed && "lg:gap-0")}>
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors",
                      groupActive ? "text-primary" : "text-[#A1AAC8] group-hover:text-primary"
                    )}
                  />
                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                      collapsed ? "lg:max-w-0 lg:opacity-0" : "lg:max-w-[160px] lg:opacity-100"
                    )}
                  >
                    {item.label}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[#535C76] transition-transform duration-300 ease-in-out",
                    collapsed && "lg:hidden",
                    !isOpen && "rotate-180"
                  )}
                />
              </button>

              {!collapsed && (
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="ml-[19px] flex flex-col gap-1 border-l border-hairline pl-4 pt-1">
                      {item.subItems.map((subItem, index) => {
                        const active = pathname === subItem.href;
                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            onClick={onCloseMobile}
                            aria-current={active ? "page" : undefined}
                            style={{ transitionDelay: isOpen ? `${index * 30}ms` : "0ms" }}
                            className={cn(
                              "font-ui flex items-center gap-3 rounded-lg border px-3 py-2 text-[13px] font-medium outline-none transition-all duration-200 ease-out focus:outline-none focus-visible:outline-none",
                              isOpen ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
                              active
                                ? "border-hairline bg-surface font-semibold text-heading shadow-card"
                                : "border-transparent text-[#434C69] hover:bg-accent hover:text-body"
                            )}
                          >
                            <subItem.icon
                              className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-[#A1AAC8]")}
                            />
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
                    className="z-50 flex w-56 flex-col gap-1 rounded-2xl border border-hairline bg-surface p-2 shadow-card-hover"
                  >
                    <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                      {item.label}
                    </p>
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
                          className={cn(
                            "font-ui flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-[13px] font-medium outline-none transition-all focus:outline-none focus-visible:outline-none",
                            active
                              ? "border-accent-line bg-accent font-semibold text-heading"
                              : "text-[#434C69] hover:bg-accent hover:text-body"
                          )}
                        >
                          <subItem.icon
                            className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-[#A1AAC8]")}
                          />
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

      {searchOpen &&
        createPortal(
          <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />,
          document.body
        )}
    </aside>
  );
}
