import type { ReactNode } from "react";

/**
 * Every admin page opens the same way: one title, one line on what the page
 * is for, and the page's own actions on the right.
 */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** Actions or status, right-aligned. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-heading">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-subtle">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Pages render per request, so the data really is live as of this load. */
export function LiveIndicator({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-medium text-body">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--viz-good) opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-(--viz-good)" />
      </span>
      {label}
    </span>
  );
}
