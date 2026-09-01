"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpCircle, ChevronDown, Database, Download, FileText, Image as ImageIcon, Wand2 } from "lucide-react";
import { CREDITS_CHANGED_EVENT } from "@/lib/client/credits-bus";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlasticButton } from "@/components/ui/plastic-button";
import { cn } from "@/lib/utils";

interface CreditsSummary {
  allocated: number;
  used: number;
  balance: number;
  images: number;
  bends: number;
  downloads: number;
  transcripts: number;
}

const USAGE_ROWS: { key: keyof Pick<CreditsSummary, "images" | "bends" | "downloads" | "transcripts">; label: string; icon: typeof ImageIcon }[] = [
  { key: "images", label: "Images Created", icon: ImageIcon },
  { key: "bends", label: "Niche Bends Run", icon: Wand2 },
  { key: "downloads", label: "Downloads", icon: Download },
  { key: "transcripts", label: "Transcripts Extracted", icon: FileText },
];

export function CreditDropdown({ onUpgradeClick }: { onUpgradeClick: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<CreditsSummary | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshSummary = useCallback(() => {
    fetch("/api/credits/summary")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSummary(data);
      })
      .catch(() => {
        // Keep showing the last known summary rather than blanking it.
      });
  }, []);

  useEffect(() => {
    refreshSummary();
    window.addEventListener(CREDITS_CHANGED_EVENT, refreshSummary);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, refreshSummary);
  }, [refreshSummary]);

  useEffect(() => {
    if (!isOpen) return;
    refreshSummary();

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, refreshSummary]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Credits"
        className="flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-surface pl-3 pr-2.5 text-sm font-medium text-heading transition-colors hover:bg-accent"
      >
        <Database className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline-block">Credit</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-body transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl">
          <div className="flex items-center gap-2.5 px-4 py-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Database className="h-3.5 w-3.5 text-primary" />
            </span>
            <span className="text-sm font-semibold text-heading">Your Credits</span>
          </div>

          <div className="px-4 pb-4">
            <div className="rounded-lg bg-accent/50 p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium tracking-wide text-subtle uppercase">Balance</span>
                {summary == null ? (
                  <Skeleton className="h-6 w-20 rounded" />
                ) : (
                  <span className="font-mono text-xl font-bold tabular-nums text-success">{summary.balance.toLocaleString()}</span>
                )}
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-hairline">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{
                    width: summary && summary.allocated > 0 ? `${Math.min(100, (summary.used / summary.allocated) * 100)}%` : "0%",
                  }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-subtle">
                {summary == null ? (
                  <>
                    <Skeleton className="h-3.5 w-16 rounded" />
                    <Skeleton className="h-3.5 w-20 rounded" />
                  </>
                ) : (
                  <>
                    <span>
                      <span className="font-mono font-medium tabular-nums text-danger">{summary.used.toLocaleString()}</span> used
                    </span>
                    <span>
                      <span className="font-mono font-medium tabular-nums text-heading">{summary.allocated.toLocaleString()}</span> allocated
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-hairline px-4 py-1">
            {USAGE_ROWS.map(({ key, label, icon: Icon }, i) => (
              <div
                key={key}
                className={cn("flex items-center justify-between py-2.5", i < USAGE_ROWS.length - 1 && "border-b border-hairline")}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-app">
                    <Icon className="h-3.5 w-3.5 text-subtle" />
                  </span>
                  <span className="text-sm text-heading">{label}</span>
                </div>
                <span className="font-mono text-xs font-medium tabular-nums text-subtle">
                  {summary == null ? "..." : summary[key].toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="p-4 pt-3">
            <PlasticButton
              onClick={() => {
                setIsOpen(false);
                onUpgradeClick();
              }}
              className="w-full py-2 font-semibold"
              text={
                <>
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  Upgrade
                </>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
