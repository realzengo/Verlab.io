"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminSelectOption<T extends string> {
  value: T;
  label: string;
}

/**
 * The admin's dropdown, in place of the native select: a quiet bordered
 * trigger with the chevron given real room, and a small menu on the surface
 * with a check on the chosen row. `size="sm"` is the 32px filter above a
 * table, where `prefix` names what it filters ("Plan  Pro"); `size="md"`
 * matches the 38px text fields in admin forms.
 */
export function AdminSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  prefix,
  size = "md",
  align = "left",
  className,
}: {
  value: T;
  options: AdminSelectOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name for the trigger. */
  label: string;
  /** A muted word before the value, for filters. */
  prefix?: string;
  size?: "sm" | "md";
  /** Which trigger edge the menu lines up with. */
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function show() {
    setActive(selectedIndex);
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function choose(index: number) {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    close();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1;
    if (event.key === "ArrowDown") setActive((i) => Math.min(last, i + 1));
    else if (event.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(last);
    else if (event.key === "Enter" || event.key === " ") choose(active);
    else if (event.key === "Escape") close();
    else if (event.key === "Tab") return close(false);
    else return;
    event.preventDefault();
  }

  return (
    <div ref={rootRef} className={cn("relative", size === "md" && "w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={prefix ? undefined : label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-lg border bg-surface text-left text-heading outline-none transition-[border-color,box-shadow,background-color] duration-150",
          "focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--color-accent)]",
          size === "sm" ? "h-8 pl-3 pr-2 text-[13px]" : "h-[38px] pl-3 pr-2.5 text-sm",
          open ? "border-primary shadow-[0_0_0_3px_var(--color-accent)]" : "border-hairline hover:bg-(--admin-fill)"
        )}
      >
        {prefix && <span className="shrink-0 text-subtle">{prefix}</span>}
        {prefix && <span className="sr-only">{label}:</span>}
        <span className={cn("min-w-0 flex-1 truncate", prefix && "font-medium")}>{selected?.label}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-subtle transition-transform duration-150", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKeyDown}
          className={cn(
            "admin-select-menu absolute top-[calc(100%+4px)] z-40 max-h-72 min-w-full overflow-y-auto rounded-[10px] border border-hairline bg-surface p-1 shadow-(--shadow-elevated) outline-none",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  "flex h-8 cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-md pl-2.5 pr-2 text-[13px]",
                  i === active ? "bg-(--admin-fill-strong) text-heading" : "text-body",
                  isSelected && "font-medium text-heading"
                )}
              >
                <span className="flex-1">{option.label}</span>
                <Check className={cn("h-4 w-4 shrink-0 text-primary", !isSelected && "invisible")} aria-hidden="true" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
