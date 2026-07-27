"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
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

function SegmentedControl<T extends string>({
  ariaLabel,
  items,
  value,
  onChange,
}: {
  ariaLabel: string;
  items: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const layoutId = useId();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-full border border-hairline/60 bg-app p-1 shadow-inner"
    >
      {items.map((item) => {
        const isActive = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className="relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold sm:px-4 sm:text-[13px]"
          >
            {isActive && (
              <motion.span
                layoutId={`${layoutId}-active`}
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
                className="absolute inset-0 rounded-full bg-primary"
              />
            )}
            <span
              className={cn(
                "relative z-10 transition-colors",
                isActive ? "text-white" : "text-body hover:text-heading"
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function getMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-first index
  const gridStart = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    return day;
  });
}

function Calendar({
  value,
  onSelect,
  onClear,
}: {
  value: string;
  onSelect: (iso: string) => void;
  onClear: () => void;
}) {
  const selected = parseISODate(value);
  const [viewDate, setViewDate] = useState(selected ?? new Date());
  const todayISO = toISODate(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = getMonthGrid(year, month);
  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="w-[248px]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-heading">{monthLabel}</p>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="rounded-md p-1 text-body transition-colors hover:bg-accent hover:text-heading"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="rounded-md p-1 text-body transition-colors hover:bg-accent hover:text-heading"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="text-[10px] font-semibold uppercase tracking-wide text-body/60">
            {label}
          </span>
        ))}
        {days.map((day) => {
          const iso = toISODate(day);
          const inMonth = day.getMonth() === month;
          const isSelected = iso === value;
          const isToday = iso === todayISO;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                isSelected
                  ? "bg-primary text-white shadow-blue"
                  : inMonth
                    ? "text-heading hover:bg-accent"
                    : "text-body/40 hover:bg-accent/60",
                isToday && !isSelected && "ring-1 ring-inset ring-primary/50"
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2.5">
        <button type="button" onClick={onClear} className="text-xs font-semibold text-body hover:text-heading">
          Clear
        </button>
        <button
          type="button"
          onClick={() => onSelect(todayISO)}
          className="text-xs font-semibold text-primary hover:text-primary-hover"
        >
          Today
        </button>
      </div>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  align = "start",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const selected = parseISODate(value);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (fieldRef.current && !fieldRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={fieldRef} className="relative flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-body">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border bg-app px-2.5 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30",
          open ? "border-primary/40" : "border-hairline",
          selected ? "text-heading" : "text-body/60"
        )}
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-body/70" />
        <span className="truncate">{selected ? formatDisplayDate(selected) : "Select date"}</span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full z-30 mt-2 rounded-xl border border-hairline bg-surface p-3 shadow-card-hover",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          <Calendar
            value={value}
            onSelect={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
            onClear={() => {
              onChange("");
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
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
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <SegmentedControl
        ariaLabel="Platform"
        items={PLATFORM_PILLS}
        value={platform}
        onChange={onPlatformChange}
      />

      <span aria-hidden="true" className="hidden h-6 w-px bg-hairline sm:block" />

      <SegmentedControl
        ariaLabel="Posting window"
        items={TIME_WINDOWS}
        value={timeWindow}
        onChange={onTimeWindowChange}
      />

      <div ref={containerRef} className="relative">
        <Button
          type="button"
          variant={activeCount > 0 ? "primary" : "secondary"}
          size="sm"
          bevel={false}
          icon={SlidersHorizontal}
          onClick={() => (open ? setOpen(false) : openPopover())}
          className={
            activeCount > 0
              ? "shadow-blue"
              : "shadow-none border-hairline/60 bg-app hover:bg-accent"
          }
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>

        {open && (
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 bg-black/40 sm:hidden"
          />
        )}

        {open && (
          <div className="fixed inset-x-4 top-1/2 z-30 max-h-[85vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-hairline bg-surface p-5 shadow-card-hover sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:z-20 sm:w-[360px] sm:max-h-none sm:translate-y-0 sm:overflow-visible">
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
                  align="start"
                />
                <DateField
                  label="Before"
                  value={pending.postedBefore}
                  onChange={(value) => updatePending("postedBefore", value)}
                  align="end"
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
