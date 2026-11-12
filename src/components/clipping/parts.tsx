"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/** Whether a media query matches, kept live (false on the server). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Phones: the step's main action, pinned to the bottom of the screen above the home indicator. */
export function MobileActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_32px_-18px_rgba(16,24,40,0.22)] lg:hidden dark:shadow-[0_-12px_32px_-18px_rgba(0,0,0,0.8)]">
      {children}
    </div>
  );
}

/** GET/POST JSON, throwing the server's own `error` message on failure. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !data) {
    throw new Error(data?.error ?? "Something went wrong. Try again.");
  }
  return data;
}

/**
 * The product's signature: a moment's virality score as a white chip with a
 * blue flame, the same on the player, the clip covers and the Tools card.
 */
export function ScoreChip({
  score,
  size = "sm",
  className,
}: {
  score: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-white/95 font-semibold tabular-nums leading-none text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.2)]",
        size === "md" ? "h-8 gap-1 pl-2.5 pr-3 text-[14px]" : "h-6 gap-0.5 pl-1.5 pr-2 text-[12px]",
        className
      )}
    >
      <Flame
        className={cn("fill-[#335cff] text-[#335cff]", size === "md" ? "h-3.5 w-3.5" : "h-3 w-3")}
        strokeWidth={2}
      />
      {score}
    </span>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[10px] bg-(--app-fill) p-[3px]">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 flex-1 whitespace-nowrap rounded-[8px] px-2 text-[13px] font-medium outline-none sm:h-8 sm:px-3 transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "bg-surface text-heading shadow-[0_1px_2px_rgba(16,24,40,0.1),0_0_0_0.5px_rgba(16,24,40,0.06)] dark:bg-white/[0.1] dark:shadow-none"
                : "text-subtle hover:text-heading"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A file-safe name from a clip title. */
export function clipFileName(title: string, index: number): string {
  const base = title
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${base || `clip-${index + 1}`}.mp4`;
}

export function downloadBlob(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
