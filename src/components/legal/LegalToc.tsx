"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { clauseNumber } from "@/components/legal/prose";
import { cn } from "@/lib/utils";

type LegalTocProps = {
  items: { id: string; title: string }[];
};

export function LegalToc({ items }: LegalTocProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-144px 0px -60% 0px", threshold: 0 }
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId)
  );

  return (
    <>
      {/* Mobile: the current section, opening into the full list */}
      <div ref={menuRef} className="relative lg:hidden">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-label="On this page"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-11 w-full items-center gap-3 rounded-xl border border-hairline bg-surface px-4 text-left text-sm shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
        >
          <span className="font-mono text-xs tabular-nums text-subtle">{clauseNumber(activeIndex)}</span>
          <span className="min-w-0 flex-1 truncate text-heading">{items[activeIndex]?.title}</span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-subtle transition-transform", menuOpen && "rotate-180")}
            strokeWidth={1.5}
          />
        </button>
        {menuOpen && (
          <nav
            aria-label="On this page"
            className="absolute inset-x-0 top-full mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-hairline bg-surface p-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.08)]"
          >
            {items.map((item, index) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex gap-3 rounded-lg px-2.5 py-2 text-sm leading-5 transition-colors",
                  item.id === activeId ? "bg-app text-heading" : "text-subtle hover:text-heading"
                )}
              >
                <span className="w-5 shrink-0 font-mono text-xs leading-5 tabular-nums text-subtle">
                  {clauseNumber(index)}
                </span>
                {item.title}
              </a>
            ))}
          </nav>
        )}
      </div>

      {/* Desktop: a quiet rail with the current section marked in ink */}
      <nav aria-label="On this page" className="hidden lg:block">
        <p className="text-[13px] text-subtle">On this page</p>
        <ol className="mt-4 border-l border-hairline">
          {items.map((item, index) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={item.id === activeId ? "location" : undefined}
                className={cn(
                  "-ml-px flex gap-3 border-l py-1.5 pl-4 text-sm leading-5 transition-colors",
                  item.id === activeId
                    ? "border-heading text-heading"
                    : "border-transparent text-subtle hover:text-heading"
                )}
              >
                <span className="w-5 shrink-0 font-mono text-xs leading-5 tabular-nums text-subtle/70">
                  {clauseNumber(index)}
                </span>
                {item.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
