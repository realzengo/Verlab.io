"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CornerDownLeft, Moon, Search, Sun, type LucideIcon } from "lucide-react";
import { ADMIN_NAV_SECTIONS } from "@/lib/mock/nav";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

const KEYCAP =
  "flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-surface px-1 font-sans text-[11px] font-medium text-body shadow-[0_0_0_1px_var(--color-hairline),inset_0_-1px_0_var(--color-hairline)] dark:bg-white/[0.06]";

interface Command {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  run: () => void;
}

/**
 * ⌘K: jump to any admin page, flip the theme, or leave for the app. Opened
 * from the sidebar's search field, the top bar on phones, or the shortcut.
 */
export function AdminCommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // The shortcut works from anywhere in the admin, typing in a field included.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Reset on open (a fresh query each time), and hand focus back on close.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
    }
  }

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      returnFocus.current?.focus?.();
    };
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      onOpenChange(false);
      router.push(href);
    };
    const pages = ADMIN_NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => ({
        id: item.href,
        label: item.label,
        group: section.label ? `Pages · ${section.label}` : "Pages",
        icon: item.icon,
        run: go(item.href),
      }))
    );
    const isDark = resolvedTheme === "dark";
    return [
      ...pages,
      {
        id: "theme",
        label: isDark ? "Switch to light mode" : "Switch to dark mode",
        group: "Actions",
        icon: isDark ? Sun : Moon,
        run: () => {
          setTheme(isDark ? "light" : "dark");
          onOpenChange(false);
        },
      },
      { id: "exit", label: "Exit to app", group: "Actions", icon: ArrowLeft, run: go("/") },
    ];
  }, [router, resolvedTheme, setTheme, onOpenChange]);

  const q = query.trim().toLowerCase();
  const results = q ? commands.filter((c) => `${c.label} ${c.group}`.toLowerCase().includes(q)) : commands;
  const current = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + results.length) % Math.max(results.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[current]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
      <div
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
        className="admin-overlay-in absolute inset-0 bg-(--admin-overlay)"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the admin"
        className="admin-pop-in relative flex max-h-[min(520px,72vh)] w-full max-w-[560px] flex-col overflow-hidden rounded-[20px] shadow-(--admin-float-shadow) admin-float"
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4">
          <Search className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages and actions…"
            data-bare=""
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-cmdk-list"
            aria-activedescendant={results[current] ? `admin-cmdk-${results[current].id}` : undefined}
            className="h-13 min-w-0 flex-1 bg-transparent text-[15px] text-heading outline-none placeholder:text-subtle"
          />
          <kbd className="hidden h-5 shrink-0 items-center rounded-[5px] bg-(--admin-fill-strong) px-1.5 font-sans text-[11px] font-medium text-subtle shadow-[inset_0_-1px_0_var(--color-hairline)] sm:flex">
            Esc
          </kbd>
        </div>

        <ul ref={listRef} id="admin-cmdk-list" role="listbox" aria-label="Results" className="flex-1 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-10 text-center text-[13px] text-subtle">Nothing matches “{query}”</li>}
          {results.map((cmd, i) => {
            const header = cmd.group !== lastGroup ? cmd.group : null;
            lastGroup = cmd.group;
            const selected = i === current;
            return (
              <li key={cmd.id} role="presentation">
                {header && (
                  <p role="presentation" className="px-3 pb-1.5 pt-3 text-[11px] font-medium text-subtle first:pt-1.5">
                    {header}
                  </p>
                )}
                <div
                  id={`admin-cmdk-${cmd.id}`}
                  role="option"
                  aria-selected={selected}
                  data-index={i}
                  onPointerMove={() => setActive(i)}
                  onClick={cmd.run}
                  className={cn(
                    "flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors",
                    selected ? "bg-(--admin-fill-strong) text-heading" : "text-body"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
                      selected ? "admin-tile text-primary" : "text-subtle"
                    )}
                  >
                    <cmd.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="truncate">{cmd.label}</span>
                  {selected && <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-4 border-t border-hairline bg-(--admin-fill) px-4 py-2.5 text-[12px] text-subtle">
          <span className="flex items-center gap-1.5">
            <kbd className={KEYCAP}>↑</kbd>
            <kbd className={KEYCAP}>↓</kbd>
            Move
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className={KEYCAP}>↵</kbd>
            Open
          </span>
        </div>
      </div>
    </div>
  );
}
