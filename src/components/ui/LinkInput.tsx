"use client";

import type { FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface LinkInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  placeholder?: string;
  submitLabel?: string;
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function LinkInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Paste a link...",
  submitLabel = "Go",
  icon: Icon = Search,
  loading = false,
  className,
  "aria-label": ariaLabel,
}: LinkInputProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "group flex w-full flex-col gap-2 rounded-2xl border border-hairline bg-surface p-2 shadow-card transition-colors duration-300",
        "focus-within:border-primary/40",
        "sm:flex-row sm:items-center sm:gap-1.5 sm:rounded-full sm:p-1.5",
        className
      )}
    >
      <div className="flex flex-1 items-center gap-2.5 pl-3 sm:pl-3.5">
        <Icon className="h-4 w-4 shrink-0 text-body/70" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          className="w-full min-w-0 bg-transparent py-2.5 text-sm tracking-[-0.01em] text-heading placeholder:text-body/60 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="group flex w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold tracking-[-0.01em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 sm:w-auto"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">{submitLabel}</span>
        )}
      </button>
    </form>
  );
}
