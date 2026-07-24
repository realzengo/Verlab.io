"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, X } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SearchResult {
  key: string;
  title: string;
  group: string;
  href: string;
  icon: LucideIcon;
}

const RESULTS: SearchResult[] = SIDEBAR_NAV.flatMap((item) => {
  if (!item.subItems) {
    return [{ key: item.href, title: item.label, group: "Navigate", icon: item.icon, href: item.href }];
  }
  return item.subItems.map((subItem) => ({
    key: subItem.href,
    title: subItem.title,
    group: item.label,
    icon: subItem.icon,
    href: subItem.href,
  }));
});

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return RESULTS;
    return RESULTS.filter(
      (result) => result.title.toLowerCase().includes(q) || result.group.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
  };

  const navigateTo = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (results.length ? (prev + 1) % results.length : 0));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => (results.length ? (prev - 1 + results.length) % results.length : 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const result = results[activeIndex];
        if (result) navigateTo(result.href);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, activeIndex, onClose, navigateTo]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-surface shadow-card-hover"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3.5">
          <Search className="h-4.5 w-4.5 shrink-0 text-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Search tools and pages..."
            className="w-full bg-transparent text-sm text-heading placeholder:text-subtle outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="text-subtle hover:text-body"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-subtle">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            results.map((result, index) => (
              <button
                key={result.key}
                type="button"
                onClick={() => navigateTo(result.href)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  index === activeIndex ? "bg-accent text-primary" : "text-body hover:bg-app hover:text-heading"
                )}
              >
                <result.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate font-medium">{result.title}</span>
                <span className="shrink-0 text-xs text-subtle">{result.group}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-hairline px-4 py-2.5 text-xs text-subtle">
          <span className="flex items-center gap-1.5">
            <CornerDownLeft className="h-3 w-3" />
            Select
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-hairline px-1 py-0.5 font-sans">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-hairline px-1 py-0.5 font-sans">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
