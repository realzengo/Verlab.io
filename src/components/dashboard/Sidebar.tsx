"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { SidebarFooter } from "@/components/dashboard/SidebarFooter";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { useNicheSidebar } from "@/components/dashboard/NicheSidebarContext";
import { cn } from "@/lib/utils";

function NicheNavSection() {
  const { data, selected, toggle, clear } = useNicheSidebar();

  if (data.availableNiches.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-hairline pt-4">
      <div className="flex items-center justify-between px-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-subtle">Niches</p>
          <p className="text-[10px] font-medium text-subtle">All on TikTok</p>
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-[11px] font-medium text-body hover:text-heading"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        {data.availableNiches.map((niche) => {
          const isActive = selected.has(niche);
          const count = data.counts[niche] ?? 0;
          return (
            <button
              key={niche}
              type="button"
              aria-pressed={isActive}
              onClick={() => toggle(niche)}
              disabled={count === 0 && !isActive}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
                isActive
                  ? "border-accent-line bg-accent text-heading"
                  : "text-body hover:bg-app hover:text-heading"
              )}
            >
              <span className="truncate">{niche}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(["Tools"]);
  const [popoverGroup, setPopoverGroup] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const showNicheSection = pathname === "/app/niches" && !collapsed;

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
      className={cn(
        "fixed inset-y-0 left-0 z-50 isolate flex h-screen w-64 flex-col border-r border-hairline bg-surface transition-transform duration-300 ease-in-out md:sticky md:top-0 md:translate-x-0 md:shrink-0 md:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "md:w-[76px]" : "md:w-64"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b border-hairline px-4 py-5",
          collapsed && "md:justify-center md:px-0"
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "hidden items-center gap-1.5 rounded-lg outline-none focus-visible:outline-none md:flex",
            collapsed && "md:gap-0"
          )}
        >
          <LogoMark
            className={cn(
              "h-7 w-7 shrink-0 -rotate-90 text-heading transition-all duration-300 ease-in-out",
              collapsed && "md:h-8 md:w-8 md:rotate-0"
            )}
          />
          <Logo
            height={24}
            className={cn(
              "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
              collapsed ? "md:max-w-0 md:opacity-0" : "md:max-w-[170px] md:opacity-100"
            )}
          />
        </button>
        <div className="flex items-center gap-1.5 md:hidden">
          <LogoMark className="h-7 w-7 shrink-0 -rotate-90 text-heading" />
          <Logo height={24} />
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="text-subtle hover:text-body md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-3">
        {SIDEBAR_NAV.map((item) => {
          if (!item.subItems) {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium outline-none transition-all duration-150 focus:outline-none focus-visible:outline-none",
                  collapsed && "md:justify-center md:gap-0 md:px-0",
                  active
                    ? "border-accent-line bg-accent font-semibold text-heading"
                    : "text-body hover:bg-app hover:text-heading"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon
                  className={cn(
                    "h-4.5 w-4.5 shrink-0 transition-colors",
                    active ? "text-primary" : "text-subtle group-hover:text-body"
                  )}
                />
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                    collapsed ? "md:max-w-0 md:opacity-0" : "md:max-w-[160px] md:opacity-100"
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
                }}
                onClick={() => (collapsed ? togglePopover(item.label) : toggleGroup(item.label))}
                aria-expanded={collapsed ? popoverOpen : isOpen}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  collapsed && "md:justify-center md:px-0",
                  groupActive
                    ? "text-heading"
                    : "text-body hover:bg-app hover:text-heading"
                )}
                title={collapsed ? item.label : undefined}
              >
                <span className={cn("flex items-center gap-3", collapsed && "md:gap-0")}>
                  <item.icon
                    className={cn(
                      "h-4.5 w-4.5 shrink-0 transition-colors",
                      groupActive ? "text-primary" : "text-subtle"
                    )}
                  />
                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                      collapsed ? "md:max-w-0 md:opacity-0" : "md:max-w-[160px] md:opacity-100"
                    )}
                  >
                    {item.label}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-subtle transition-transform duration-300 ease-in-out",
                    collapsed && "md:hidden",
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
                              "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm outline-none transition-all duration-200 ease-out focus:outline-none focus-visible:outline-none",
                              isOpen ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
                              active
                                ? "border-accent-line bg-accent font-semibold text-heading"
                                : "text-subtle hover:bg-app hover:text-body"
                            )}
                          >
                            <subItem.icon
                              className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-subtle")}
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
                            "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm outline-none transition-all focus:outline-none focus-visible:outline-none",
                            active
                              ? "border-accent-line bg-accent font-semibold text-heading"
                              : "text-subtle hover:bg-app hover:text-body"
                          )}
                        >
                          <subItem.icon
                            className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-subtle")}
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

        {showNicheSection && <NicheNavSection />}
      </nav>

      <SidebarFooter
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
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
