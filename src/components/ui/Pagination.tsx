import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PageToken = number | "ellipsis";

// Windowed pagination: always shows first/last page plus a small window
// around the current page, collapsing the rest into an ellipsis -- adapts to
// however many real pages of data there actually are (a 2-page result set
// just renders "Prev 1 2 Next", it doesn't pad out to a fixed page count).
function buildPageTokens(current: number, total: number): PageToken[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const tokens: PageToken[] = [1];
  if (current > 3) tokens.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let page = start; page <= end; page++) tokens.push(page);

  if (current < total - 2) tokens.push("ellipsis");
  tokens.push(total);

  return tokens;
}

const buttonClass =
  "rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm font-medium text-body transition-colors hover:bg-app disabled:cursor-not-allowed disabled:opacity-40";

export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const tokens = buildPageTokens(page, totalPages);

  return (
    <nav aria-label="Pagination" className={cn("mb-16 mt-10 flex items-center justify-center gap-2", className)}>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} className={buttonClass}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {tokens.map((token, index) =>
        token === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-sm text-subtle">
            …
          </span>
        ) : (
          <button
            key={token}
            type="button"
            onClick={() => onChange(token)}
            aria-current={token === page ? "page" : undefined}
            className={cn(
              buttonClass,
              token === page && "border-ink bg-ink text-white hover:bg-ink"
            )}
          >
            {token}
          </button>
        )
      )}

      <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages} className={buttonClass}>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}
