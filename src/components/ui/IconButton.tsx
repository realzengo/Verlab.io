"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function IconButton({
  onClick,
  active,
  destructive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        destructive
          ? "text-subtle hover:bg-danger-tint hover:text-danger"
          : active
            ? "bg-accent text-primary"
            : "text-subtle hover:bg-accent hover:text-heading"
      )}
    >
      {children}
    </button>
  );
}
