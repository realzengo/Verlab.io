"use client";

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

export function ScorePill({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full bg-black/35 px-3 text-[13px] font-semibold tabular-nums text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-white/15 backdrop-blur-xl backdrop-saturate-150",
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
              "h-8 flex-1 rounded-[8px] px-3 text-[13px] font-medium outline-none transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-primary/40",
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
