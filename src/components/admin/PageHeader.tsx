import type { ReactNode } from "react";

/**
 * Every admin page opens the same way. The title the eye reads sits in the
 * top bar, so here the h1 is for screen readers and the outline; what shows
 * is one line on what the page is for, with the page's own actions on the
 * right.
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="sr-only">{title}</h1>
        {description && <p className="max-w-2xl text-[14px] leading-5 text-subtle">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Pages render per request, so the data really is live as of this load. */
export function LiveIndicator({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-full bg-surface pl-2.5 pr-3 text-[12px] font-medium text-body shadow-[0_0_0_1px_var(--color-hairline),0_1px_2px_rgba(10,10,30,0.05)] dark:bg-white/[0.06] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <span className="h-1.5 w-1.5 rounded-full bg-(--viz-good) shadow-[0_0_0_3px_color-mix(in_srgb,var(--viz-good)_18%,transparent)]" />
      {label}
    </span>
  );
}
