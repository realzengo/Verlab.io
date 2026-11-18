"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, type LucideIcon } from "lucide-react";
import { AdminDialog, AdminDialogFooter, ADMIN_BUTTON } from "@/components/admin/AdminDialog";
import { TimeSeriesChart } from "@/components/admin/charts/TimeSeriesChart";
import type { DetailRow, DetailSpec } from "@/components/admin/details";
import { cn } from "@/lib/utils";

const TONE: Record<NonNullable<DetailRow["tone"]>, string> = {
  default: "text-heading",
  good: "text-success",
  warning: "text-warning",
  bad: "text-danger",
  muted: "text-subtle",
};

/** Copies a value and confirms with a check for a moment. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={done ? "Copied" : label}
      title={done ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          // Clipboard blocked (insecure origin, permissions); nothing to do.
        }
      }}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-subtle transition-colors hover:bg-(--admin-fill-strong) hover:text-heading"
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/**
 * Label on the left, value on the right, one hairline between rows: a
 * receipt for whatever the dialog is about.
 */
export function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface dark:bg-white/[0.02]">
      {rows.map((row) => (
        <div key={row.label} className="flex min-h-11 items-center justify-between gap-6 px-4 py-2.5">
          <dt className="shrink-0 text-[13px] text-subtle">{row.label}</dt>
          <dd className={cn("flex min-w-0 items-center justify-end gap-1.5 text-right text-[13px] font-medium", TONE[row.tone ?? "default"])}>
            {row.href ? (
              <a
                href={row.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1 hover:underline"
                title={row.value}
              >
                <span className={cn("truncate", row.mono && "font-mono text-[12px]")}>{row.value}</span>
                <ExternalLink className="h-3 w-3 shrink-0 text-subtle" aria-hidden="true" />
              </a>
            ) : (
              <span className={cn("min-w-0 break-words tabular-nums", row.mono && "break-all font-mono text-[12px] font-normal")}>
                {row.value}
              </span>
            )}
            {row.mono && <CopyButton value={row.value} label={`Copy ${row.label.toLowerCase()}`} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A passage under the rows: a full error message, the most common reason. */
export function DetailNote({ label, text, tone = "default" }: { label: string; text: string; tone?: "default" | "bad" }) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3",
        tone === "bad"
          ? "bg-danger-tint shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-danger)_16%,transparent)]"
          : "bg-(--admin-fill) shadow-[inset_0_0_0_1px_var(--color-hairline)]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-[12px] font-medium", tone === "bad" ? "text-danger" : "text-subtle")}>{label}</p>
        <CopyButton value={text} label={`Copy ${label.toLowerCase()}`} />
      </div>
      <p className="mt-1 select-text whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.55] text-heading">{text}</p>
    </div>
  );
}

/**
 * The dialog a list row opens: optional daily line, the detail rows, an
 * optional note, and the caller's extra actions beside Close.
 */
export function DetailDialog({
  spec,
  onClose,
  icon,
  media,
  badge,
  actions,
  children,
}: {
  /** null closes it. */
  spec: DetailSpec | null;
  onClose: () => void;
  icon?: LucideIcon;
  media?: ReactNode;
  /** A status badge under the title. */
  badge?: ReactNode;
  actions?: ReactNode;
  /** Extra content between the rows and the footer. */
  children?: ReactNode;
}) {
  return (
    <AdminDialog
      open={spec !== null}
      onClose={onClose}
      size="md"
      icon={icon}
      media={media}
      title={
        spec && (
          <span className="flex min-w-0 items-center gap-2">
            {spec.tag && (
              <span className="shrink-0 rounded-md bg-(--admin-fill-strong) px-1.5 py-0.5 font-mono text-[11px] font-medium text-body">
                {spec.tag}
              </span>
            )}
            <span className="min-w-0 break-words">{spec.title}</span>
          </span>
        )
      }
      description={
        spec && (spec.subtitle || badge) ? (
          <span className="flex flex-wrap items-center gap-2">
            {badge}
            {spec.subtitle}
          </span>
        ) : undefined
      }
    >
      {spec && (
        <>
          <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
            {spec.series && (
              <div className="rounded-xl border border-hairline bg-surface px-3 pt-3 dark:bg-white/[0.02]">
                <TimeSeriesChart
                  dates={spec.series.dates}
                  series={[{ label: spec.series.label, values: spec.series.values }]}
                  format={spec.series.format}
                  height={110}
                  ariaLabel={`${spec.series.label} per day`}
                />
              </div>
            )}
            <DetailRows rows={spec.rows} />
            {spec.note && <DetailNote {...spec.note} />}
            {children}
          </div>
          <AdminDialogFooter>
            {actions}
            <button type="button" data-autofocus="" onClick={onClose} className={ADMIN_BUTTON.secondary}>
              Close
            </button>
          </AdminDialogFooter>
        </>
      )}
    </AdminDialog>
  );
}
