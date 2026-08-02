"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpCircle, ChevronDown, Database, Download, FileText, Image as ImageIcon, Wand2 } from "lucide-react";
import { CREDITS_CHANGED_EVENT } from "@/lib/client/credits-bus";
import { Skeleton } from "@/components/ui/Skeleton";
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
        className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface py-1.5 pl-3 pr-2.5 text-sm font-medium text-heading transition-colors hover:bg-accent"
      >
        <Database className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline-block">Credit</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-body transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-hairline bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-hairline px-3.5 py-2.5">
            <Database className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold tracking-wide text-heading uppercase">Your Credits</span>
          </div>

          <div className="border-b border-hairline px-3.5 py-1">
            <div className="flex items-center justify-between border-b border-hairline py-2 text-sm">
              <span className="text-subtle">Allocated</span>
              {summary == null ? (
                <Skeleton className="h-4 w-8 rounded" />
              ) : (
                <span className="font-mono font-medium tabular-nums text-heading">{summary.allocated.toLocaleString()}</span>
              )}
            </div>
            <div className="flex items-center justify-between border-b border-hairline py-2 text-sm">
              <span className="text-subtle">Used</span>
              {summary == null ? (
                <Skeleton className="h-4 w-8 rounded" />
              ) : (
                <span className="font-mono font-medium tabular-nums text-danger">{summary.used.toLocaleString()}</span>
              )}
            </div>
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-subtle">Balance</span>
              {summary == null ? (
                <Skeleton className="h-4 w-8 rounded" />
              ) : (
                <span className="font-mono font-medium tabular-nums text-success">{summary.balance.toLocaleString()}</span>
              )}
            </div>
          </div>

          <div className="px-3.5 py-1">
            {USAGE_ROWS.map(({ key, label, icon: Icon }, i) => (
              <div
                key={key}
                className={cn("flex items-center justify-between py-2", i < USAGE_ROWS.length - 1 && "border-b border-hairline")}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-subtle" />
                  <span className="text-sm text-heading">{label}</span>
                </div>
                <span className="font-mono text-xs tabular-nums text-subtle">
                  {summary == null ? "..." : summary[key].toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="p-3.5 pt-2.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onUpgradeClick();
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-btn-primary py-2 text-sm font-semibold text-white transition-colors hover:bg-btn-primary-hover"
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              Upgrade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
