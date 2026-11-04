import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The admin's one container: white surface, hairline edge, a header with a
 * title, an optional one-line description and an optional action. `flush`
 * drops the body padding so a table runs edge to edge under the header.
 */
export function Panel({
  title,
  description,
  action,
  flush = false,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const hasHeader = Boolean(title || description || action);
  return (
    <section className={cn("flex min-w-0 flex-col rounded-card border border-hairline bg-surface shadow-card", className)}>
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold leading-5 tracking-[-0.01em] text-heading">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-5 text-subtle">{description}</p>}
          </div>
          {action && <div className="flex min-w-0 max-w-full shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div
        className={cn(
          "flex-1",
          flush ? cn("admin-panel-flush", hasHeader && "pt-4") : hasHeader ? "px-5 pb-5 pt-4" : "p-5",
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** A big number at the head of a chart panel -- exactly one per view. */
export function HeroFigure({ value, caption }: { value: string; caption?: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-heading sm:text-[48px]">{value}</p>
      {caption && <p className="mt-2 text-[13px] text-subtle">{caption}</p>}
    </div>
  );
}

/** A page-level notice: something to fix before the numbers below can be trusted. */
export function Callout({
  icon,
  title,
  children,
  tone = "warning",
}: {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  tone?: "warning" | "info";
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-card border px-4 py-3.5",
        tone === "warning" ? "border-warning/25 bg-warning-tint" : "border-hairline bg-surface"
      )}
    >
      <span className={cn("mt-0.5 shrink-0", tone === "warning" ? "text-warning" : "text-primary")}>{icon}</span>
      <div className="min-w-0 text-[13px] leading-5">
        <p className="font-medium text-heading">{title}</p>
        {children && <div className="mt-0.5 text-body">{children}</div>}
      </div>
    </div>
  );
}

/** A small label/value cell for secondary figures inside a panel. */
export function MiniStat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "warning" | "critical";
}) {
  return (
    <div className="min-w-0 rounded-lg bg-(--admin-fill) px-3.5 py-3">
      <p className="truncate text-[12px] font-medium text-subtle">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tracking-[-0.01em]",
          tone === "warning" ? "text-warning" : tone === "critical" ? "text-danger" : "text-heading"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-[12px] text-subtle">{hint}</p>}
    </div>
  );
}
