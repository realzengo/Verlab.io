"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Form parts shared by every admin dialog, so fields and actions read the
// same everywhere. Inputs take their 8px radius and focus ring from the
// `.admin-theme input` rules in globals.css.
export const ADMIN_FIELD =
  "h-[38px] w-full border border-hairline bg-surface px-3 text-sm text-heading shadow-[0_1px_2px_rgba(10,10,30,0.04)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-subtle";
export const ADMIN_LABEL = "mb-1.5 block text-[13px] font-medium text-heading";
export const ADMIN_HINT = "mt-1.5 text-[12px] leading-[1.45] text-subtle";

const BUTTON =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[13.5px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-(--admin-float) disabled:pointer-events-none disabled:opacity-50";
export const ADMIN_BUTTON = {
  secondary: cn(
    BUTTON,
    "bg-surface text-heading shadow-[0_0_0_1px_var(--color-hairline),0_1px_2px_rgba(10,10,30,0.05)] hover:bg-(--admin-fill-strong) dark:bg-white/[0.04]"
  ),
  primary: cn(
    BUTTON,
    "bg-btn-primary text-white shadow-[0_1px_2px_rgba(16,24,80,0.2),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-btn-primary-hover"
  ),
  danger: cn(
    BUTTON,
    "bg-[#dc2626] text-white shadow-[0_1px_2px_rgba(80,16,16,0.2),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-[#c81e1e]"
  ),
};

/**
 * The admin's one modal. A soft scrim, a floating sheet that rises in, an
 * icon tile beside the title, then the caller's body and footer. Rendered
 * into the admin root so it keeps the admin tokens and sits above the shell.
 */
export function AdminDialog({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  media,
  tone = "default",
  size = "sm",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** In place of the icon tile, e.g. the user's avatar the dialog acts on. */
  media?: ReactNode;
  tone?: "default" | "danger";
  size?: "sm" | "md";
  /** Usually <AdminDialogBody> and <AdminDialogFooter>, inside a <form>. */
  children: ReactNode;
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Closes only when a click starts and ends on the scrim, so dragging a text
  // selection out of a field never dismisses the form.
  const downOnScrim = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    // First field if there is one, else the sheet itself.
    const first = panelRef.current?.querySelector<HTMLElement>("input, textarea, [data-autofocus]");
    (first ?? panelRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      // A menu inside the dialog (AdminSelect) claims Escape first.
      if (e.key === "Escape" && !e.defaultPrevented) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnTo?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const root = document.querySelector(".admin-theme") ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div aria-hidden="true" className="admin-overlay-in fixed inset-0 bg-(--admin-overlay)" />
      <div
        className="relative flex min-h-full items-center justify-center p-4"
        onPointerDown={(e) => {
          downOnScrim.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (downOnScrim.current && e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cn(
            "admin-float admin-pop-in relative w-full rounded-[20px] shadow-(--admin-float-shadow) outline-none",
            size === "md" ? "max-w-[480px]" : "max-w-[420px]"
          )}
        >
          <div className="flex items-start gap-3.5 px-6 pt-6">
            {media}
            {!media && Icon && (
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                  tone === "danger" ? "bg-danger-tint text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-danger)_18%,transparent)]" : "admin-tile text-heading"
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id={titleId} className="text-[16px] font-semibold leading-6 tracking-[-0.01em] text-heading">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-[13px] leading-5 text-subtle">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-(--admin-fill-strong) hover:text-heading"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    root
  );
}

export function AdminDialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4 px-6 pb-6 pt-5", className)}>{children}</div>;
}

/** The action row: a quiet well along the bottom, actions on the right. */
export function AdminDialogFooter({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-[20px] border-t border-hairline bg-(--admin-fill) px-6 py-4">
      {note && <p className="mr-auto text-[12px] text-subtle">{note}</p>}
      {children}
    </div>
  );
}

/** A yes/no question, in the dialog's language. Drop-in for ConfirmDialog. */
export function AdminConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  icon,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <AdminDialog open={isOpen} onClose={onClose} title={title} description={description} icon={icon} tone={danger ? "danger" : "default"}>
      <div className="h-6" />
      <AdminDialogFooter>
        {/* Focus lands on the safe choice when the action destroys something. */}
        <button type="button" onClick={onClose} data-autofocus={danger ? "" : undefined} className={ADMIN_BUTTON.secondary}>
          {cancelLabel}
        </button>
        <button
          type="button"
          data-autofocus={danger ? undefined : ""}
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={danger ? ADMIN_BUTTON.danger : ADMIN_BUTTON.primary}
        >
          {confirmLabel}
        </button>
      </AdminDialogFooter>
    </AdminDialog>
  );
}
