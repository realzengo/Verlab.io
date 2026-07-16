"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";

type LegalTocProps = {
  items: { id: string; title: string }[];
};

export function LegalToc({ items }: LegalTocProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

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
      { rootMargin: "-112px 0px -70% 0px", threshold: 0 }
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [items]);

  return (
    <>
      {/* Mobile: horizontal pill scroller */}
      <nav
        aria-label="On this page"
        className="sticky top-[76px] z-30 -mx-4 mb-6 flex gap-2 overflow-x-auto bg-app/95 px-4 py-3 backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeId === item.id
                ? "border-primary bg-primary text-white"
                : "border-hairline bg-surface text-subtle hover:text-heading"
            }`}
          >
            {item.title}
          </a>
        ))}
      </nav>

      {/* Desktop: sticky card sidebar */}
      <nav aria-label="On this page" className="hidden rounded-card-sm border border-hairline bg-surface p-4 shadow-card lg:block">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle">
          <List className="h-3.5 w-3.5" /> On this page
        </div>
        <ul className="mt-3 flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeId === item.id
                    ? "bg-accent font-semibold text-primary"
                    : "text-subtle hover:bg-app hover:text-heading"
                }`}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
