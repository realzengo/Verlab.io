import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared building blocks for every settings tab: a titled section holding
// one bordered group of rows, each row a label + description on the left
// and its control on the right. Keeps spacing, type and controls identical
// across tabs -- the skeletons in components/skeletons/SettingsSkeletons.tsx
// mirror these shapes.

export function SettingsSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  /** Optional control beside the heading, e.g. a refresh or "connect" button. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-6 text-heading">{title}</h2>
          {description && <p className="mt-0.5 text-sm leading-5 text-subtle">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4 divide-y divide-hairline rounded-xl border border-hairline bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  control,
  children,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  /** The row's action, right-aligned on desktop and below the text on phones. */
  control?: ReactNode;
  /** Expanded content under the description: an inline form, a notice. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium leading-5 text-heading">{label}</div>
        {description && <div className="mt-0.5 text-sm leading-5 text-subtle">{description}</div>}
        {children}
      </div>
      {control && <div className="flex shrink-0 items-center gap-2">{control}</div>}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-btn-primary text-white hover:bg-btn-primary-hover",
  secondary: "border border-hairline bg-surface text-heading hover:bg-btn-secondary",
  danger: "border border-hairline bg-surface text-danger hover:border-danger/30 hover:bg-danger-tint",
};

/** Classes for a settings button or link-as-button. `size="md"` is for inline forms. */
export function settingsButton(variant: ButtonVariant = "secondary", size: "sm" | "md" = "sm") {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "h-8" : "h-9",
    BUTTON_VARIANTS[variant]
  );
}

/** Classes for a settings text input. */
export function settingsInput({ size = "md", invalid = false }: { size?: "sm" | "md"; invalid?: boolean } = {}) {
  return cn(
    "w-full rounded-lg border bg-surface px-3 text-sm text-heading outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-subtle focus:ring-2",
    size === "sm" ? "h-8" : "h-9",
    invalid ? "border-danger/50 focus:border-danger focus:ring-danger/15" : "border-hairline focus:border-primary focus:ring-primary/15"
  );
}
