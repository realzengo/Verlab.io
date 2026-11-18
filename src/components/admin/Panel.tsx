import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/admin/AnimatedNumber";

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
    <section className={cn("admin-card flex min-w-0 flex-col rounded-card border border-hairline shadow-card", className)}>
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-[14px] font-semibold leading-5 tracking-[-0.01em] text-heading">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-5 text-subtle">{description}</p>}
          </div>
          {action && <div className="flex min-w-0 max-w-full shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div
        className={cn(
          "flex-1",
          flush ? cn("admin-panel-flush", hasHeader && "pt-4") : hasHeader ? "px-5 pb-5 pt-4 sm:px-6 sm:pb-6" : "p-5 sm:p-6",
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * A big number at the head of a chart panel -- exactly one per view. With a
 * `unit` it reads as one phrase ("107 runs"): the number in ink, the unit in
 * muted ink at the same size.
 */
export function HeroFigure({
  value,
  unit,
  caption,
  delta,
}: {
  value: string;
  unit?: string;
  caption?: ReactNode;
  delta?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <p className="text-[40px] font-semibold leading-none tracking-[-0.035em] sm:text-[48px]">
          <span className="text-heading">
            <AnimatedNumber value={value} />
          </span>
          {unit && <span className="font-medium text-subtle"> {unit}</span>}
        </p>
        {delta}
      </div>
      {caption && <p className="mt-2.5 text-[13px] text-subtle">{caption}</p>}
    </div>
  );
}

/**
 * A short row of label/value pairs for a panel header's action slot: the
 * figures a chart's reader looks for first (today, the peak), divided by
 * hairlines rather than boxed.
 */
export function HeaderStats({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode }[] }) {
  return (
    <dl className="flex items-start">
      {items.map((item, i) => (
        <div key={item.label} className={cn("min-w-0", i > 0 && "ml-5 border-l border-hairline pl-5")}>
          <dt className="text-[12px] leading-4 text-subtle">{item.label}</dt>
          <dd className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-heading">{item.value}</span>
            {item.hint && <span className="text-[12px] text-subtle">{item.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
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
  // A column, so a tile stretched by its grid row keeps the label on top and
  // the figure on the bottom edge instead of a gap under the figure.
  return (
    <div className="flex min-w-0 flex-col rounded-[10px] bg-(--admin-fill) px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--admin-fill)]">
      <p className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-subtle">
        {tone !== "default" && (
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              tone === "warning" ? "bg-(--viz-warning)" : "bg-(--viz-critical)"
            )}
          />
        )}
        <span className="truncate">{label}</span>
      </p>
      <div className="mt-auto pt-1">
        <p
          className={cn(
            "text-lg font-semibold tabular-nums tracking-[-0.02em]",
            tone === "warning" ? "text-warning" : tone === "critical" ? "text-danger" : "text-heading"
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-0.5 truncate text-[12px] text-subtle">{hint}</p>}
      </div>
    </div>
  );
}
