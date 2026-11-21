"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, PanelLeft, Search, ShieldCheck } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { railFade, useSidebarCollapsed } from "@/components/dashboard/SidebarCollapsedContext";
import { DiscordIcon } from "@/components/icons/DiscordIcon";
import { ToolTile } from "@/components/dashboard/ToolTile";
import type { NavItem, NavMenuItem } from "@/lib/types";
import { cn } from "@/lib/utils";

// Tailwind's `lg`: the rail is a sticky column from here up, a drawer below.
const DESKTOP_QUERY = "(min-width: 1024px)";

// Rows grouped the way the rail shows them: the unsectioned top group first,
// then one block per `section`, each under its small grey heading.
const NAV_GROUPS = SIDEBAR_NAV.reduce<{ section: string | null; items: NavItem[] }[]>((groups, item) => {
  const section = item.section ?? null;
  const last = groups[groups.length - 1];
  if (last && last.section === section) last.items.push(item);
  else groups.push({ section, items: [item] });
  return groups;
}, []);

// Hover-menu entries whose page has no rail row of its own: being on one of
// them lights up the Tools row.
const NAV_HREFS = new Set(SIDEBAR_NAV.map((item) => item.href));
const MENU_ONLY_HREFS = SIDEBAR_NAV.flatMap((item) => (item.menu ?? []).flat().flatMap((section) => section.items))
  .map((entry) => entry.href)
  .filter((href) => !NAV_HREFS.has(href));

// How long the Tools menu stays up after the pointer leaves the row or the
// menu, so the cursor can cross the gap between them.
const MENU_CLOSE_DELAY_MS = 140;


// Open Sauce One (loaded globally in app/layout) gives the rail its rounder,
// geometric voice; the rest of the app stays on the system UI face.
const RAIL_FONT = "font-['Open_Sauce_One',ui-sans-serif,system-ui,sans-serif]";

// One 32px row for every link. The icon box starts 14px in from the rail edge
// (8px nav gutter + 6px row padding), so its centre sits at 24px -- the logo
// mark's axis, and the middle of the 48px collapsed rail. Nothing moves when
// the rail opens or closes; labels just fade (railFade) and get clipped.
// (`cn` is a plain join, not tailwind-merge, so sizes live per variant
// instead of being overridden.)
// Sizes and colours are measured off the reference rail: 13.4px labels,
// 20px icons at stroke 1.5, 7px row radius, colours from the --rail-*
// tokens in globals.css.
const ROW_BASE =
  "group flex w-full items-center overflow-hidden rounded-[7px] text-left text-[13.4px] leading-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40";
const ROW = cn(ROW_BASE, "h-8 gap-2 px-1.5");
const ROW_ACTIVE = "bg-(--rail-active) text-(--rail-ink)";
const ROW_IDLE = "text-(--rail-text) hover:bg-(--rail-hover)";
const ICON = "h-5 w-5 shrink-0";
const BADGE = "h-4 shrink-0 rounded-full bg-(--rail-badge) px-[6.5px] text-[10.6px] leading-4 text-(--rail-text)";
const ICON_STROKE = 1.5;
// Icons sit a step lighter than their label, and go to ink with it when active.
const iconTone = (active: boolean) => (active ? "text-(--rail-ink)" : "text-(--rail-icon)");
const HEADER_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-[7px] text-(--rail-faint) outline-none transition-colors hover:bg-(--rail-hover) hover:text-(--rail-text) focus-visible:ring-2 focus-visible:ring-primary/40";
const HEADER_ICON = "h-[18px] w-[18px]";

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
  const [searchOpen, setSearchOpen] = useState(false);
  // Tools' hover menu (desktop only): where it opens, or null when closed.
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const asideRef = useRef<HTMLElement | null>(null);
  const toolsRowRef = useRef<HTMLAnchorElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);

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

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const closeMenu = () => {
    cancelClose();
    setMenuPos(null);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setMenuPos(null), MENU_CLOSE_DELAY_MS);
  };
  // Opens beside the rail, its top level with the Tools row. Mouse/pen only,
  // and only on the desktop rail: on touch, and in the phone drawer, Tools is
  // just its link.
  const openMenu = (event: ReactPointerEvent) => {
    if (event.pointerType === "touch" || !window.matchMedia(DESKTOP_QUERY).matches) return;
    cancelClose();
    if (menuPos) return;
    const row = toolsRowRef.current?.getBoundingClientRect();
    const rail = asideRef.current?.getBoundingClientRect();
    if (row && rail) setMenuPos({ top: row.top, left: rail.right + 2 });
  };

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Kept on screen: a short window lifts the menu instead of cutting it off.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menuPos || !menu) return;
    const maxTop = window.innerHeight - menu.offsetHeight - 8;
    if (menuPos.top > maxTop) menu.style.top = `${Math.max(8, maxTop)}px`;
  }, [menuPos]);

  // Fixed-positioned off the row, so anything that could move the row
  // (resize, any scroll) closes it rather than leaving it adrift.
  useEffect(() => {
    if (!menuPos) return;
    const close = () => setMenuPos(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuPos]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const collapse = () => {
    closeMenu();
    setCollapsed(true);
  };

  // The logo is the home link, except on a collapsed desktop rail, where it
  // (and the panel icon it swaps to on hover) opens the rail back up.
  const handleLogoClick = (event: ReactMouseEvent) => {
    if (collapsed && window.matchMedia(DESKTOP_QUERY).matches) {
      event.preventDefault();
      closeMenu();
      setCollapsed(false);
      return;
    }
    onCloseMobile();
  };

  const fade = railFade(collapsed);

  const renderLink = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onCloseMobile}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(ROW, active ? ROW_ACTIVE : ROW_IDLE)}
      >
        {/* Discord's glyph is solid, so it's drawn a touch smaller to weigh
            the same as the outlined icons around it. */}
        <item.icon
          className={cn(ICON, iconTone(active), item.icon === DiscordIcon && "p-[2px]")}
          strokeWidth={ICON_STROKE}
          aria-hidden="true"
        />
        <span className={cn("min-w-0 truncate", fade)}>{item.label}</span>
        {item.badge && (
          <span className={cn(BADGE, fade)}>{item.badge}</span>
        )}
      </Link>
    );
  };

  const renderMenuEntry = (entry: NavMenuItem) => {
    const active = isActive(entry.href);
    return (
      <Link
        key={entry.href}
        href={entry.href}
        onClick={closeMenu}
        aria-current={active ? "page" : undefined}
        className="flex h-[47px] items-center gap-[7px] rounded-[10px] px-2 outline-none transition-colors hover:bg-(--rail-hover) focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <ToolTile icon={entry.icon} tone={entry.tone} />
        <span className="flex min-w-0 flex-col">
          <span className={cn("flex items-center gap-2 text-[13.4px] leading-4", active ? "text-(--rail-ink)" : "text-(--rail-text)")}>
            <span className="truncate">{entry.title}</span>
            {entry.badge && <span className={BADGE}>{entry.badge}</span>}
          </span>
          <span className="truncate text-[12.2px] leading-4 text-(--rail-muted)">{entry.description}</span>
        </span>
      </Link>
    );
  };

  // Tools is a plain link to /tools; on a desktop rail, hovering it also
  // shows every tool in a two-column menu beside the rail.
  const renderToolsRow = (item: NavItem) => {
    const menuOpen = menuPos !== null;
    const active = isActive(item.href) || MENU_ONLY_HREFS.some(isActive);
    return (
      <Fragment key={item.href}>
        <Link
          ref={toolsRowRef}
          href={item.href}
          onClick={() => {
            closeMenu();
            onCloseMobile();
          }}
          onPointerEnter={openMenu}
          onPointerLeave={scheduleClose}
          aria-current={isActive(item.href) ? "page" : undefined}
          title={collapsed ? item.label : undefined}
          className={cn(ROW, active ? ROW_ACTIVE : menuOpen ? "bg-(--rail-hover) text-(--rail-text)" : ROW_IDLE)}
        >
          <item.icon className={cn(ICON, iconTone(active))} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span className={cn("min-w-0 flex-1 truncate", fade)}>{item.label}</span>
          <span className={cn("-mr-px flex shrink-0", fade)}>
            <ChevronRight className="h-3.5 w-3.5 text-(--rail-faint)" strokeWidth={1.75} aria-hidden="true" />
          </span>
        </Link>

        {menuPos &&
          item.menu &&
          createPortal(
            <nav
              ref={menuRef}
              aria-label={item.label}
              onPointerEnter={cancelClose}
              onPointerLeave={scheduleClose}
              style={{ top: menuPos.top, left: menuPos.left }}
              className={cn(
                RAIL_FONT,
                "rail-menu fixed z-[60] flex w-[600px] rounded-[18px] bg-white/[0.86] pb-[27px] pt-1.5 shadow-[0_0_0_1px_rgba(16,24,40,0.035),0_2px_6px_rgba(16,24,40,0.04),0_12px_32px_-12px_rgba(16,24,40,0.1)] backdrop-blur-xl backdrop-saturate-150 dark:bg-[#121419]/[0.92] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_16px_48px_rgba(0,0,0,0.6)]"
              )}
            >
              {item.menu.map((column, c) => (
                <div key={c} className="flex w-[300px] flex-col px-2">
                  {column.map((section, i) => (
                    <div key={section.title} className={i > 0 ? "mt-2" : undefined}>
                      <p className="h-[25px] px-1.5 pt-1 text-[11.3px] leading-[14px] text-(--rail-muted)">{section.title}</p>
                      <div className="flex flex-col gap-1">{section.items.map(renderMenuEntry)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </nav>,
            document.body
          )}
      </Fragment>
    );
  };

  return (
    <aside
      ref={asideRef}
      className={cn(
        "fixed inset-y-0 left-0 z-50 isolate flex h-screen w-[264px] flex-col border-r border-(--rail-line) bg-(--rail-bg) transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:translate-x-0 lg:shrink-0 lg:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "lg:w-12" : "lg:w-[264px]"
      )}
    >
      {/* Logo left; search + panel toggle right. One logo image in both rail
          states: collapsing narrows its clip box to the mark (the first ~34px
          of the 108px-wide, 32px-tall wordmark), so the text slides away and
          the mark never swaps or moves. 7px in puts the mark's centre on the
          nav icons' 24px axis. */}
      <div className="relative flex h-[54px] shrink-0 items-center px-2">
        <Link
          href="/"
          onClick={handleLogoClick}
          aria-label={collapsed ? "Expand sidebar" : "Verlab home"}
          title={collapsed ? "Expand sidebar" : undefined}
          className="group flex items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span
            className={cn(
              "relative -ml-px block h-8 w-[108px] shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
              collapsed && "lg:w-[34px]"
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
                "absolute left-0 top-0 h-8 w-auto max-w-none transition-opacity duration-200 ease-in-out dark:hidden",
                collapsed && "lg:group-hover:opacity-0"
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
                "absolute left-0 top-0 hidden h-8 w-auto max-w-none transition-opacity duration-200 ease-in-out dark:block",
                collapsed && "lg:group-hover:opacity-0"
              )}
            />
            {collapsed && (
              <span
                aria-hidden="true"
                className="absolute left-px top-0 hidden h-8 w-8 scale-90 items-center justify-center text-(--rail-faint) opacity-0 transition-all duration-200 ease-out group-hover:scale-100 group-hover:opacity-100 lg:flex"
              >
                <PanelLeft className={HEADER_ICON} strokeWidth={1.75} />
              </span>
            )}
          </span>
        </Link>

        {/* Desktop: fades out with the labels when the rail collapses. */}
        <div
          inert={collapsed}
          className={cn(
            "absolute right-[7px] top-1/2 hidden -translate-y-1/2 items-center lg:flex",
            fade,
            collapsed && "pointer-events-none"
          )}
        >
          <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search" title="Search (⌘K)" className={HEADER_BUTTON}>
            <Search className={HEADER_ICON} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button type="button" onClick={collapse} aria-label="Collapse sidebar" title="Collapse sidebar" className={HEADER_BUTTON}>
            <PanelLeft className={HEADER_ICON} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {/* Phone drawer: the same two icons; the panel one closes the drawer. */}
        <div className="absolute right-[7px] top-1/2 flex -translate-y-1/2 items-center lg:hidden">
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              setSearchOpen(true);
            }}
            aria-label="Search"
            className={HEADER_BUTTON}
          >
            <Search className={HEADER_ICON} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button type="button" onClick={onCloseMobile} aria-label="Close menu" className={HEADER_BUTTON}>
            <PanelLeft className={HEADER_ICON} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav
        aria-label="Main"
        className={cn(RAIL_FONT, "flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2 pb-3 pt-[11px]")}
      >
        {NAV_GROUPS.map((group) => (
          <Fragment key={group.section ?? "main"}>
            {group.section && (
              // Keeps its height when the rail collapses (so icons below
              // don't jump); a short rule takes the faded heading's place.
              <p className="relative mt-[15px] h-[16.5px] px-1.5 text-[12.2px] leading-4 text-(--rail-muted)">
                <span className={fade}>{group.section}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-1.5 top-1/2 hidden h-px bg-(--rail-line) transition-opacity duration-200 lg:block",
                    collapsed ? "opacity-100 delay-150" : "opacity-0"
                  )}
                />
              </p>
            )}
            {group.items.map((item) => (item.menu ? renderToolsRow(item) : renderLink(item)))}
          </Fragment>
        ))}

        {/* Admins only; a plain row like the rest, parked at the bottom. */}
        {isAdmin && (
          <Link
            href="/admin"
            onClick={onCloseMobile}
            title={collapsed ? "Admin" : undefined}
            className={cn(ROW, ROW_IDLE, "mt-auto")}
          >
            <ShieldCheck className={cn(ICON, iconTone(false))} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span className={cn("min-w-0 truncate", fade)}>Admin</span>
          </Link>
        )}
      </nav>

      {searchOpen && createPortal(<CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />, document.body)}
    </aside>
  );
}
