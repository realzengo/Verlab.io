"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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

export function CreditDropdown() {
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
        className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface/70 py-1.5 pl-3 pr-2.5 text-sm font-medium text-heading backdrop-blur-md transition-colors hover:bg-accent"
      >
        <Database className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline-block">Credit</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-body transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl isolate",
            "border border-white/25 dark:border-white/10",
            "bg-gradient-to-b from-white/30 to-white/5 dark:from-white/[0.08] dark:to-white/[0.02]",
            "backdrop-blur-2xl backdrop-saturate-150",
            "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_0_0_1px_rgba(255,255,255,0.05),0_24px_60px_-12px_rgba(0,0,0,0.45)]",
            "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(255,255,255,0.03),0_24px_60px_-12px_rgba(0,0,0,0.6)]"
          )}
        >
          {/* Specular highlight arc — light catching the top of the glass */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(255,255,255,0.5),rgba(255,255,255,0)_60%)] dark:bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(255,255,255,0.14),rgba(255,255,255,0)_60%)]"
          />

          <div className="relative p-4">
            <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 backdrop-blur-md backdrop-saturate-150">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-heading">Your Credits</span>
            </div>

            <div className="mt-3 space-y-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-body">Credits Allocated</span>
                {summary == null ? (
                  <Skeleton className="h-4 w-8 rounded-full" />
                ) : (
                  <span className="font-semibold text-heading">{summary.allocated.toLocaleString()}</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-body">Credits Used</span>
                {summary == null ? (
                  <Skeleton className="h-4 w-8 rounded-full" />
                ) : (
                  <span className="font-semibold text-danger">{summary.used.toLocaleString()}</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-body">Credits Balance</span>
                {summary == null ? (
                  <Skeleton className="h-4 w-8 rounded-full" />
                ) : (
                  <span className="font-semibold text-success">{summary.balance.toLocaleString()}</span>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-1">
              {USAGE_ROWS.map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between rounded-lg px-1 py-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-body backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.05]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-heading">{label}</p>
                      <p className="text-xs text-subtle">
                        {summary == null ? "..." : `${summary[key].toLocaleString()} created`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/pricing"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-btn-primary py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35)] transition-colors hover:bg-btn-primary-hover"
            >
              <ArrowUpCircle className="h-4 w-4" />
              Upgrade
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
