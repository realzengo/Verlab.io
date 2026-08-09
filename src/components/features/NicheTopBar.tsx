"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpDown,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useNicheSidebar } from "@/components/dashboard/NicheSidebarContext";
import { cn } from "@/lib/utils";

export type VideoPlatformFilter = "all" | "tiktok" | "youtube";
export type VideoTimeWindow = "all" | "7d" | "30d";
export type VideoSort = "views" | "newest";

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

const SORT_OPTIONS: { id: VideoSort; label: string }[] = [
  { id: "views", label: "Most viewed" },
  { id: "newest", label: "Newest" },
];

// Neutral, boxy chrome shared by every row-1 trigger button (Search,
// Filters, Presets) -- deliberately no brand-blue anywhere in this bar, to
// match the flat gray/white toolbar it's cloned from.
const TOOLBAR_BUTTON =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3.5 text-[13px] font-semibold text-heading shadow-card transition-colors hover:bg-[#F2F2F9] dark:hover:bg-[#242428]";
const TOOLBAR_BUTTON_ICON = "h-4 w-4 shrink-0 text-body/50";

function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, onClose]);
  return ref;
}

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
      className="inline-flex h-9 items-center gap-0.5 rounded-xl border border-hairline bg-app p-1"
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
            className="relative flex h-full items-center whitespace-nowrap rounded-lg px-3.5 text-[12.5px] font-semibold sm:px-4 sm:text-[13px]"
          >
            {isActive && (
              <motion.span
                layoutId={`${layoutId}-active`}
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
                className="absolute inset-0 rounded-lg bg-surface shadow-card"
              />
            )}
            <span className={cn("relative z-10 transition-colors", isActive ? "text-heading" : "text-body hover:text-heading")}>
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
        className="w-full rounded-lg border border-hairline bg-app px-2.5 py-2 text-sm text-heading placeholder:text-body/60 focus:outline-none focus:ring-2 focus:ring-heading/15"
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

function Calendar({ value, onSelect, onClear }: { value: string; onSelect: (iso: string) => void; onClear: () => void }) {
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
            className="rounded-md p-1 text-body transition-colors hover:bg-app hover:text-heading"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="rounded-md p-1 text-body transition-colors hover:bg-app hover:text-heading"
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
                  ? "bg-ink text-white"
                  : inMonth
                    ? "text-heading hover:bg-app"
                    : "text-body/40 hover:bg-app/60",
                isToday && !isSelected && "ring-1 ring-inset ring-heading/40"
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
        <button type="button" onClick={() => onSelect(todayISO)} className="text-xs font-semibold text-heading hover:text-body">
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
  const fieldRef = useClickOutside(open, () => setOpen(false));
  const selected = parseISODate(value);

  return (
    <div ref={fieldRef} className="relative flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-body">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border bg-app px-2.5 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-heading/15",
          open ? "border-heading/30" : "border-hairline",
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

function FiltersPopover({
  timeWindow,
  onTimeWindowChange,
  filters,
  onApply,
  onClear,
}: {
  timeWindow: VideoTimeWindow;
  onTimeWindowChange: (window: VideoTimeWindow) => void;
  filters: VideoRangeFilters;
  onApply: (filters: VideoRangeFilters) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<VideoRangeFilters>(filters);
  const [pendingWindow, setPendingWindow] = useState<VideoTimeWindow>(timeWindow);
  const containerRef = useClickOutside(open, () => setOpen(false));
  const activeCount = countActiveRangeFilters(filters) + (timeWindow !== "all" ? 1 : 0);

  function openPopover() {
    setPending(filters);
    setPendingWindow(timeWindow);
    setOpen(true);
  }

  function updatePending(key: keyof VideoRangeFilters, value: string) {
    setPending((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    onApply(pending);
    onTimeWindowChange(pendingWindow);
    setOpen(false);
  }

  function handleClear() {
    setPending(EMPTY_VIDEO_RANGE_FILTERS);
    setPendingWindow("all");
    onClear();
    onTimeWindowChange("all");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => (open ? setOpen(false) : openPopover())} className={TOOLBAR_BUTTON}>
        <SlidersHorizontal className={TOOLBAR_BUTTON_ICON} />
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>

      {open && (
        <>
          <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-black/40 sm:hidden" />
          <div className="fixed inset-x-4 top-1/2 z-30 max-h-[85vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-hairline bg-surface p-5 shadow-card-hover sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:z-20 sm:w-[360px] sm:max-h-none sm:translate-y-0 sm:overflow-visible">
            <p className="text-base font-bold text-heading">Refine results</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-body">Narrow the trending feed</p>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-body">Posting window</p>
              <div className="mt-1.5">
                <SegmentedControl
                  ariaLabel="Posting window"
                  items={[
                    { id: "all", label: "All time" },
                    { id: "7d", label: "7d" },
                    { id: "30d", label: "30d" },
                  ]}
                  value={pendingWindow}
                  onChange={setPendingWindow}
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-body">Views</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <RangeInput label="Minimum" placeholder="e.g. 100000" value={pending.viewsMin} onChange={(v) => updatePending("viewsMin", v)} />
                <RangeInput label="Maximum" placeholder="e.g. 1000000" value={pending.viewsMax} onChange={(v) => updatePending("viewsMax", v)} />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-body">Followers</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <RangeInput label="Minimum" placeholder="e.g. 1000" value={pending.followersMin} onChange={(v) => updatePending("followersMin", v)} />
                <RangeInput label="Maximum" placeholder="e.g. 1000000" value={pending.followersMax} onChange={(v) => updatePending("followersMax", v)} />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-body">Posted between</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <DateField label="After" value={pending.postedAfter} onChange={(v) => updatePending("postedAfter", v)} align="start" />
                <DateField label="Before" value={pending.postedBefore} onChange={(v) => updatePending("postedBefore", v)} align="end" />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
              <button type="button" onClick={handleClear} className="text-xs font-semibold text-body hover:text-heading">
                Clear
              </button>
              <Button type="button" size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Quick-jump into a single niche, backed by the same selection state the
 * sidebar's niche list drives (see NicheSidebarContext) -- picking one here
 * and picking one in the sidebar are the same action. */
function PresetsDropdown() {
  const { data, selected, toggle, clear } = useNicheSidebar();
  const [open, setOpen] = useState(false);
  const containerRef = useClickOutside(open, () => setOpen(false));
  const activeNiche = selected.size > 0 ? [...selected][0] : null;

  if (data.availableNiches.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((prev) => !prev)} className={TOOLBAR_BUTTON}>
        <Layers className={TOOLBAR_BUTTON_ICON} />
        {activeNiche ?? "Niches"}
        <ChevronDown className={cn(TOOLBAR_BUTTON_ICON, "transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 max-h-80 w-64 overflow-y-auto rounded-2xl border border-hairline bg-surface p-2 shadow-card-hover">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-subtle">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              Niches
            </p>
            {activeNiche && (
              <button
                type="button"
                onClick={() => {
                  clear();
                  setOpen(false);
                }}
                className="text-[11px] font-medium text-body hover:text-heading"
              >
                Clear
              </button>
            )}
          </div>
          {data.availableNiches.map((niche) => {
            const isActive = selected.has(niche);
            const count = data.counts[niche];
            return (
              <button
                key={niche}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  toggle(niche);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors",
                  isActive ? "bg-app text-heading" : "text-body font-medium hover:bg-app hover:text-heading"
                )}
              >
                <span className="truncate">{niche}</span>
                {typeof count === "number" && count > 0 && (
                  <span className="shrink-0 text-[11px] font-semibold text-subtle">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortDropdown({ sort, onSortChange }: { sort: VideoSort; onSortChange: (sort: VideoSort) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useClickOutside(open, () => setOpen(false));
  const activeLabel = SORT_OPTIONS.find((o) => o.id === sort)?.label ?? "Sort";

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((prev) => !prev)} className={TOOLBAR_BUTTON}>
        <ArrowUpDown className={TOOLBAR_BUTTON_ICON} />
        <span className="text-body">Sort by</span> {activeLabel}
        <ChevronDown className={cn(TOOLBAR_BUTTON_ICON, "transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-44 overflow-hidden rounded-xl border border-hairline bg-surface p-1 shadow-card-hover">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onSortChange(option.id);
                setOpen(false);
              }}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors",
                option.id === sort ? "bg-app text-heading" : "text-body font-medium hover:bg-app hover:text-heading"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NicheTopBar({
  query,
  onQueryChange,
  onSearchSubmit,
  platform,
  onPlatformChange,
  timeWindow,
  onTimeWindowChange,
  rangeFilters,
  onApplyRangeFilters,
  onClearRangeFilters,
  sort,
  onSortChange,
  page,
  hasMore,
  onPageChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  platform: VideoPlatformFilter;
  onPlatformChange: (platform: VideoPlatformFilter) => void;
  timeWindow: VideoTimeWindow;
  onTimeWindowChange: (window: VideoTimeWindow) => void;
  rangeFilters: VideoRangeFilters;
  onApplyRangeFilters: (filters: VideoRangeFilters) => void;
  onClearRangeFilters: () => void;
  sort: VideoSort;
  onSortChange: (sort: VideoSort) => void;
  page: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-hairline bg-surface px-4 shadow-card sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
      <div className="flex flex-wrap items-center gap-2 py-3 sm:gap-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
          className="relative min-w-[220px] flex-1"
        >
          <Search className={cn(TOOLBAR_BUTTON_ICON, "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2")} />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search viral videos by keyword, creator, or hashtag…"
            className="w-full rounded-xl border border-hairline bg-surface py-2 pl-9 pr-8 text-[13px] text-heading shadow-card placeholder:text-body/60 transition-shadow focus:outline-none focus:ring-2 focus:ring-heading/15 focus:shadow-card-hover"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                onQueryChange("");
                onSearchSubmit();
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-body/60 hover:text-heading"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        <button type="button" onClick={onSearchSubmit} className={cn(TOOLBAR_BUTTON, "bg-app")}>
          Search
        </button>

        <FiltersPopover
          timeWindow={timeWindow}
          onTimeWindowChange={onTimeWindowChange}
          filters={rangeFilters}
          onApply={onApplyRangeFilters}
          onClear={onClearRangeFilters}
        />

        <PresetsDropdown />

        <SegmentedControl ariaLabel="Platform" items={PLATFORM_PILLS} value={platform} onChange={onPlatformChange} />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-hairline/70 py-2 text-xs text-subtle">
        <SortDropdown sort={sort} onSortChange={onSortChange} />

        {(page > 1 || hasMore) && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              className="flex h-7 items-center gap-1 rounded-lg border border-hairline bg-surface px-2.5 text-xs font-semibold text-body shadow-card transition-colors hover:text-heading disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="flex h-7 min-w-7 items-center justify-center rounded-lg border border-hairline bg-surface px-2 text-xs font-semibold text-heading shadow-card">
              {page}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={!hasMore}
              aria-label="Next page"
              className="flex h-7 items-center gap-1 rounded-lg border border-hairline bg-surface px-2.5 text-xs font-semibold text-body shadow-card transition-colors hover:text-heading disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
