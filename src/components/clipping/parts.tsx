"use client";

import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/** GET/POST JSON, throwing the server's own `error` message on failure. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !data) {
    throw new Error(data?.error ?? "Something went wrong. Try again.");
  }
  return data;
}

/** A viewfinder: four corner brackets just outside the framed content. */
export function BracketFrame({ children, className }: { children: ReactNode; className?: string }) {
  const corner = "pointer-events-none absolute h-4 w-4 border-heading/25 dark:border-white/30";
  return (
    <div className={cn("relative p-2.5", className)}>
      <span aria-hidden className={cn(corner, "left-0 top-0 border-l-[1.5px] border-t-[1.5px]")} />
      <span aria-hidden className={cn(corner, "right-0 top-0 border-r-[1.5px] border-t-[1.5px]")} />
      <span aria-hidden className={cn(corner, "bottom-0 left-0 border-b-[1.5px] border-l-[1.5px]")} />
      <span aria-hidden className={cn(corner, "bottom-0 right-0 border-b-[1.5px] border-r-[1.5px]")} />
      {children}
    </div>
  );
}

export function ScorePill({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full bg-black/55 px-3 text-[13px] font-semibold tabular-nums text-white backdrop-blur-md",
        className
      )}
    >
      Score {score}
      <Flame className="h-3.5 w-3.5 fill-orange-400 text-orange-400" strokeWidth={1.5} />
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
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-(--app-fill) p-0.5">
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
              "h-7 flex-1 rounded-md px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "bg-surface text-heading shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_0.5px_rgba(16,24,40,0.08)] dark:bg-white/[0.1] dark:shadow-none"
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
