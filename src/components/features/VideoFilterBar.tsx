"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type VideoPlatformFilter = "all" | "tiktok" | "youtube";
export type VideoTimeWindow = "all" | "7d" | "30d";

export interface VideoRangeFilters {
  viewsMin: string;
  viewsMax: string;
  followersMin: string;
  followersMax: string;
  postedAfter: string;
  postedBefore: string;
}

export const EMPTY_VIDEO_RANGE_FILTERS: VideoRangeFilters = {
  viewsMin: "",
  viewsMax: "",
  followersMin: "",
  followersMax: "",
  postedAfter: "",
  postedBefore: "",
};

export function countActiveRangeFilters(filters: VideoRangeFilters): number {
  return Object.values(filters).filter(Boolean).length;
}

const PLATFORM_PILLS: { id: VideoPlatformFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
];

const TIME_WINDOWS: { id: VideoTimeWindow; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

function RangeInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-body">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-hairline bg-app px-2.5 py-2 text-sm text-heading placeholder:text-body/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-body">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-hairline bg-app px-2.5 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

export function VideoFilterBar({
  platform,
  onPlatformChange,
  timeWindow,
  onTimeWindowChange,
  filters,
  onApply,
  onClear,
}: {
  platform: VideoPlatformFilter;
  onPlatformChange: (platform: VideoPlatformFilter) => void;
  timeWindow: VideoTimeWindow;
  onTimeWindowChange: (window: VideoTimeWindow) => void;
  filters: VideoRangeFilters;
  onApply: (filters: VideoRangeFilters) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<VideoRangeFilters>(filters);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCount = countActiveRangeFilters(filters);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function openPopover() {
    setPending(filters);
    setOpen(true);
  }

  function updatePending(key: keyof VideoRangeFilters, value: string) {
    setPending((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    onApply(pending);
    setOpen(false);
  }

  function handleClear() {
    setPending(EMPTY_VIDEO_RANGE_FILTERS);
    onClear();
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label="Platform" className="inline-flex items-center gap-1 rounded-full bg-app p-1">
        {PLATFORM_PILLS.map((pill) => {
          const isActive = pill.id === platform;
          return (
            <button
              key={pill.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onPlatformChange(pill.id)}
              className={cn(
                "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                isActive ? "bg-surface text-heading shadow-card" : "text-body hover:text-heading"
              )}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      <div role="tablist" aria-label="Posting window" className="inline-flex items-center gap-1 rounded-full bg-app p-1">
        {TIME_WINDOWS.map((window) => {
          const isActive = window.id === timeWindow;
          return (
            <button
              key={window.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTimeWindowChange(window.id)}
              className={cn(
                "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                isActive ? "bg-success text-white" : "text-body hover:text-heading"
              )}
            >
              {window.label}
            </button>
          );
        })}
      </div>

      <div ref={containerRef} className="relative">
        <Button
          type="button"
          variant={activeCount > 0 ? "primary" : "secondary"}
          size="sm"
          icon={SlidersHorizontal}
          onClick={() => (open ? setOpen(false) : openPopover())}
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>

        {open && (
          <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[min(90vw,360px)] rounded-2xl border border-hairline bg-surface p-5 shadow-card-hover">
            <p className="text-base font-bold text-heading">Refine results</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-body">
              Adjust feed filters
            </p>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-body">Views</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <RangeInput
                  label="Minimum"
                  placeholder="e.g. 100000"
                  value={pending.viewsMin}
                  onChange={(value) => updatePending("viewsMin", value)}
                />
                <RangeInput
                  label="Maximum"
                  placeholder="e.g. 1000000"
                  value={pending.viewsMax}
                  onChange={(value) => updatePending("viewsMax", value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-body">Followers</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <RangeInput
                  label="Minimum"
                  placeholder="e.g. 1000"
                  value={pending.followersMin}
                  onChange={(value) => updatePending("followersMin", value)}
                />
                <RangeInput
                  label="Maximum"
                  placeholder="e.g. 1000000"
                  value={pending.followersMax}
                  onChange={(value) => updatePending("followersMax", value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-body">Posting window</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <DateField
                  label="After"
                  value={pending.postedAfter}
                  onChange={(value) => updatePending("postedAfter", value)}
                />
                <DateField
                  label="Before"
                  value={pending.postedBefore}
                  onChange={(value) => updatePending("postedBefore", value)}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-semibold text-body hover:text-heading"
              >
                Clear
              </button>
              <Button type="button" size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
