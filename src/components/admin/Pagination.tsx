"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const count = (n: number) => n.toLocaleString("en-US");

/** Height of the sticky admin top bar plus a little air, so a scrolled-to
 * panel lands just under it instead of behind it. */
const TOP_BAR_OFFSET = 72;

/**
 * Splits `items` into pages of `pageSize`. Changing `resetKey` (a search,
 * filter or sort) goes back to page 1; a list that shrinks under the current
 * page clamps to its last page instead of showing nothing.
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey = "") {
  const [page, setPage] = useState(1);
  const [lastKey, setLastKey] = useState(resetKey);
  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;

  return {
    page: current,
    pageCount,
    setPage,
    pageItems: items.slice(start, start + pageSize),
    pagerProps: { page: current, pageCount, pageSize, total: items.length, onPageChange: setPage },
  };
}

/** 1 … 4 5 6 … 12: always the first and last page, the current one and its
 * neighbours, with a gap marker only where it hides two or more pages. */
function pageList(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const from = Math.max(2, Math.min(page - 1, pageCount - 4));
  const to = Math.min(pageCount - 1, Math.max(page + 1, 5));
  const list: (number | "gap")[] = [1];
  if (from === 3) list.push(2);
  else if (from > 3) list.push("gap");
  for (let p = from; p <= to; p++) list.push(p);
  if (to === pageCount - 2) list.push(pageCount - 1);
  else if (to < pageCount - 2) list.push("gap");
  list.push(pageCount);
  return list;
}

const STEP =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";

/**
 * The footer under a paged admin table: the visible range on the left, page
 * steps on the right. Renders nothing when everything fits on one page.
 */
export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  noun = "rows",
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  noun?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  if (pageCount <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  function go(next: number) {
    if (next < 1 || next > pageCount || next === page) return;
    onPageChange(next);
    // A shorter last page pulls the footer up; keep the table's head in view.
    const panel = ref.current?.closest("section");
    const top = panel?.getBoundingClientRect().top;
    if (top !== undefined && top < TOP_BAR_OFFSET) window.scrollBy({ top: top - TOP_BAR_OFFSET, behavior: "smooth" });
  }

  return (
    <footer
      ref={ref}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline px-5 py-3"
    >
      <p className="text-[13px] tabular-nums text-subtle">
        <span className="font-medium text-heading">
          {count(first)}–{count(last)}
        </span>{" "}
        of {count(total)} {noun}
      </p>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className={cn(STEP, "text-subtle hover:bg-(--admin-fill) hover:text-heading disabled:pointer-events-none disabled:opacity-40")}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {pageList(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="inline-flex h-8 w-6 items-center justify-center text-[13px] text-subtle" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                STEP,
                p === page
                  ? "bg-surface font-medium text-heading shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_var(--color-hairline)]"
                  : "text-body hover:bg-(--admin-fill) hover:text-heading"
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page === pageCount}
          aria-label="Next page"
          className={cn(STEP, "text-subtle hover:bg-(--admin-fill) hover:text-heading disabled:pointer-events-none disabled:opacity-40")}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>
    </footer>
  );
}
