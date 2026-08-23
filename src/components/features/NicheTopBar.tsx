"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Search,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { useNicheSidebar } from "@/components/dashboard/NicheSidebarContext";
import { cn, formatNumber } from "@/lib/utils";
import { SHORT_TEXT_MAX } from "@/lib/validation";

export type VideoPlatformFilter = "all" | "tiktok" | "youtube";
export type VideoTimeWindow = "all" | "24h" | "7d" | "30d" | "90d" | "365d";
export type VideoSort = "views" | "newest";

export interface VideoRangeFilters {
  viewsMin: string;
  viewsMax: string;
  followersMin: string;
  followersMax: string;
  /** 2-letter YouTube region codes; empty means worldwide. */
  countries: string[];
}

export const EMPTY_VIDEO_RANGE_FILTERS: VideoRangeFilters = {
  viewsMin: "",
  viewsMax: "",
  followersMin: "",
  followersMax: "",
  countries: [],
};

export function countActiveRangeFilters(filters: VideoRangeFilters): number {
  const { countries, ...ranges } = filters;
  return Object.values(ranges).filter(Boolean).length + (countries.length > 0 ? 1 : 0);
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

export function SegmentedControl<T extends string>({
  ariaLabel,
  items,
  value,
  onChange,
}: {
  ariaLabel: string;
  items: { id: T; label: string; icon?: LucideIcon }[];
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
        const Icon = item.icon;
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
            <span
              className={cn(
                "relative z-10 flex items-center gap-1.5 transition-colors",
                isActive ? "text-heading" : "text-body hover:text-heading"
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Card shell shared by every field in the filters panel -- label + a
 * per-field Reset (disabled when that field has no active value) up top,
 * an optional "Range (x-y)" subtitle, then the control itself. */
function FilterCard({
  label,
  subtitle,
  active,
  onReset,
  children,
}: {
  label: string;
  subtitle?: string;
  active: boolean;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-app p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-heading">{label}</p>
        <button
          type="button"
          onClick={onReset}
          disabled={!active}
          className="text-xs font-semibold text-body transition-colors hover:text-heading disabled:pointer-events-none disabled:opacity-40"
        >
          Reset
        </button>
      </div>
      {subtitle && <p className="mt-0.5 text-[11px] font-medium text-body/70">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** A FilterCard wrapping a dual-handle RangeSlider -- shared by Outlier
 * Score, Views, and Subscribers. The handle at either bound (boundMin/
 * boundMax) is treated as "unbounded" and clears to "" rather than sending
 * the literal edge number, matching the "10M+" style open-ended labels
 * shown under the track. */
// Views/Subscribers deliberately aren't built from a formula --
// the first half of the track (0%-50%) covers 0 up to just under 1M with
// increasingly large "nice" steps (most of a real video's view count lives
// here, so it gets the fine control), then the second half is a plain
// linear ramp in flat 500K steps: 1M, 1.5M, 2M, ... up to 10M, matching how
// someone actually thinks about the top tier. Both halves have exactly 18
// points so 1,000,000 lands precisely on the midpoint index.
const VIEWS_LOW_HALF = [
  0, 10, 50, 100, 200, 400, 600, 800, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 750_000,
];
const VIEWS_HIGH_HALF = Array.from({ length: 18 }, (_, i) => 1_500_000 + i * 500_000);
const VIEWS_BREAKPOINTS = [...VIEWS_LOW_HALF, 1_000_000, ...VIEWS_HIGH_HALF];

function closestBreakpointIndex(value: number, breakpoints: number[]): number {
  let bestIndex = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < breakpoints.length; i++) {
    const diff = Math.abs(breakpoints[i] - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }
  return bestIndex;
}

// A breakpoint list only has a few dozen entries -- if the native input's
// own step domain were just [0, breakpoints.length-1], each drag step would
// be a big, visible jump (the "cutting" feel). Instead the input drags
// across this much finer position range, and BREAKPOINT_POSITION_MAX steps
// (rounded to whichever breakpoint index that position is closest to) so
// the handle glides continuously under the cursor while the reported value
// still only ever lands on a clean number.
const BREAKPOINT_POSITION_MAX = 1000;

function breakpointIndexToPosition(index: number, count: number): number {
  return Math.round((index / (count - 1)) * BREAKPOINT_POSITION_MAX);
}

function positionToBreakpointIndex(position: number, count: number): number {
  return Math.round((position / BREAKPOINT_POSITION_MAX) * (count - 1));
}

function RangeFilterCard({
  label,
  rangeLabel,
  formatValue,
  minBoundLabel,
  maxBoundLabel,
  boundMin,
  boundMax,
  step,
  breakpoints,
  minValue,
  maxValue,
  onChange,
  onReset,
}: {
  label: string;
  rangeLabel: string;
  /** Renders a handle's live value once it's been dragged off its bound. */
  formatValue: (value: number) => string;
  /** Shown in place of a live value while that handle still sits at its
   * unbounded extreme (i.e. no filter on that side yet). */
  minBoundLabel: string;
  maxBoundLabel: string;
  boundMin: number;
  boundMax: number;
  step: number;
  /** When given, the slider snaps between these fixed values (see
   * VIEWS_BREAKPOINTS) instead of dragging continuously through every
   * integer in [boundMin, boundMax]. */
  breakpoints?: number[];
  minValue: string;
  maxValue: string;
  onChange: (min: string, max: string) => void;
  onReset: () => void;
}) {
  const sliderMin = minValue ? Number(minValue) : boundMin;
  const sliderMax = maxValue ? Number(maxValue) : boundMax;
  // Clamped so the label text never spills past the card edge when a handle
  // sits right at 0% or 100% of the track.
  const clampPct = (pct: number) => Math.min(Math.max(pct, 4), 96);

  function positionFor(value: number): number {
    return breakpoints ? breakpointIndexToPosition(closestBreakpointIndex(value, breakpoints), breakpoints.length) : value;
  }

  // For breakpoint cards, the native <input>'s controlled value has to be
  // this raw drag position -- NOT re-derived from the snapped breakpoint on
  // every render. Feeding the snapped value straight back in would fight
  // the browser's own smooth thumb tracking (it'd get reset to the nearest
  // breakpoint's position on every re-render, mid-drag), which is exactly
  // what produced the "cutting" feel. Re-synced from props (via the
  // lastMinValue/lastMaxValue comparison below) only when minValue/maxValue
  // changed for a reason other than this card's own onChange -- e.g. Reset
  // All, or the panel reopening with different already-applied filters.
  const [dragPosMin, setDragPosMin] = useState(() => positionFor(sliderMin));
  const [dragPosMax, setDragPosMax] = useState(() => positionFor(sliderMax));
  const [lastMinValue, setLastMinValue] = useState(minValue);
  const [lastMaxValue, setLastMaxValue] = useState(maxValue);
  if (minValue !== lastMinValue) {
    setLastMinValue(minValue);
    setDragPosMin(positionFor(sliderMin));
  }
  if (maxValue !== lastMaxValue) {
    setLastMaxValue(maxValue);
    setDragPosMax(positionFor(sliderMax));
  }

  const trackMin = breakpoints ? 0 : boundMin;
  const trackMax = breakpoints ? BREAKPOINT_POSITION_MAX : boundMax;
  const trackValueMin = breakpoints ? dragPosMin : sliderMin;
  const trackValueMax = breakpoints ? dragPosMax : sliderMax;
  const pctMin = clampPct(((trackValueMin - trackMin) / (trackMax - trackMin || 1)) * 100);
  const pctMax = clampPct(((trackValueMax - trackMin) / (trackMax - trackMin || 1)) * 100);
  // Once the handles are close enough that their labels would smear into
  // each other, the min label pops up into a floating pill above the track
  // instead -- vertical separation instead of a horizontal collision, so it
  // stays legible no matter how close the two values get.
  const isColliding = pctMax - pctMin < 16;

  function handleTrackChange(nextTrackMin: number, nextTrackMax: number) {
    if (breakpoints) {
      setDragPosMin(nextTrackMin);
      setDragPosMax(nextTrackMax);
    }
    const nextMin = breakpoints ? breakpoints[positionToBreakpointIndex(nextTrackMin, breakpoints.length)] : nextTrackMin;
    const nextMax = breakpoints ? breakpoints[positionToBreakpointIndex(nextTrackMax, breakpoints.length)] : nextTrackMax;
    onChange(nextMin <= boundMin ? "" : String(nextMin), nextMax >= boundMax ? "" : String(nextMax));
  }

  return (
    <FilterCard label={label} subtitle={rangeLabel} active={Boolean(minValue || maxValue)} onReset={onReset}>
      <div className="relative">
        <AnimatePresence>
          {isColliding && (
            <motion.span
              key="min-tooltip"
              initial={{ opacity: 0, y: 6, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 520, damping: 28 }}
              className="absolute -top-6 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-heading px-2 py-0.5 text-[10px] font-bold text-app shadow-card"
              style={{ left: `${pctMin}%` }}
            >
              {minValue ? formatValue(sliderMin) : minBoundLabel}
            </motion.span>
          )}
        </AnimatePresence>

        <RangeSlider
          min={trackMin}
          max={trackMax}
          step={breakpoints ? 1 : step}
          valueMin={trackValueMin}
          valueMax={trackValueMax}
          onChange={handleTrackChange}
        />

        {/* Live labels tracking each handle's position -- once a handle
            moves off its bound they swap from the static "0"/"10M+" bound
            text to the actual dragged-to value, following that handle
            horizontally. The min label fades out here while its floating
            twin above is showing, so there's only ever one of it visible. */}
        <div className="relative mt-2 h-4 text-[11px] font-semibold text-body/70">
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap transition-opacity duration-200"
            style={{ left: `${pctMin}%`, opacity: isColliding ? 0 : 1 }}
          >
            {minValue ? formatValue(sliderMin) : minBoundLabel}
          </span>
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pctMax}%` }}>
            {maxValue ? formatValue(sliderMax) : maxBoundLabel}
          </span>
        </div>
      </div>
    </FilterCard>
  );
}

/** Shared dropdown-trigger pill used by the Country and Publishing Date
 * cards -- a rounded field with a chevron, opening a floating list. */
function DropdownTrigger({ open, onClick, children }: { open: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-full border bg-surface px-3.5 py-2 text-left text-sm font-semibold text-heading transition-colors",
        open ? "border-primary" : "border-hairline"
      )}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 shrink-0 text-body/50 transition-transform", open && "rotate-180")} />
    </button>
  );
}

const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "IN", label: "India" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
  { code: "NL", label: "Netherlands" },
  { code: "SE", label: "Sweden" },
  { code: "PH", label: "Philippines" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
];

function CountryFilterCard({
  selected,
  onChange,
  onReset,
}: {
  selected: string[];
  onChange: (codes: string[]) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useClickOutside(open, () => setOpen(false));
  const label =
    selected.length === 0
      ? "Any country"
      : selected.length === 1
        ? (COUNTRY_OPTIONS.find((c) => c.code === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`;

  function toggle(code: string) {
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  }

  return (
    <FilterCard label="Country" active={selected.length > 0} onReset={onReset}>
      <div ref={containerRef} className="relative">
        <DropdownTrigger open={open} onClick={() => setOpen((prev) => !prev)}>
          <span className="truncate">{label}</span>
        </DropdownTrigger>

        {open && (
          <div className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-56 w-full overflow-y-auto rounded-xl border border-hairline bg-surface p-1 shadow-card-hover">
            {COUNTRY_OPTIONS.map((c) => {
              const isActive = selected.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => toggle(c.code)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors",
                    isActive ? "bg-app text-heading" : "text-body hover:bg-app hover:text-heading"
                  )}
                >
                  <span className="truncate">{c.label}</span>
                  {isActive && <span className="text-xs font-bold text-primary">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </FilterCard>
  );
}

const PUBLISHING_DATE_OPTIONS: { id: VideoTimeWindow; label: string }[] = [
  { id: "all", label: "Any time" },
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "365d", label: "Last year" },
];

function PublishingDateCard({
  value,
  onChange,
  onReset,
}: {
  value: VideoTimeWindow;
  onChange: (window: VideoTimeWindow) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useClickOutside(open, () => setOpen(false));
  const activeLabel = PUBLISHING_DATE_OPTIONS.find((o) => o.id === value)?.label ?? "Any time";

  return (
    <FilterCard label="Publishing date" active={value !== "all"} onReset={onReset}>
      <div ref={containerRef} className="relative">
        <DropdownTrigger open={open} onClick={() => setOpen((prev) => !prev)}>
          <span className="truncate">{activeLabel}</span>
        </DropdownTrigger>

        {open && (
          <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-full overflow-hidden rounded-xl border border-hairline bg-surface p-1 shadow-card-hover">
            {PUBLISHING_DATE_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors",
                  o.id === value ? "bg-app text-heading" : "text-body hover:bg-app hover:text-heading"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </FilterCard>
  );
}

/** Toggle for the inline filters panel below -- a plain button (not a
 * popover trigger) since the panel it controls renders full-width as a
 * sibling block, not anchored under this button. */
function FiltersToggleButton({
  open,
  activeCount,
  onClick,
}: {
  open: boolean;
  activeCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(TOOLBAR_BUTTON, open && "border-primary text-primary")}
    >
      <SlidersHorizontal className={cn(TOOLBAR_BUTTON_ICON, open && "text-primary")} />
      Filters{activeCount > 0 ? ` (${activeCount})` : ""}
    </button>
  );
}

/** Full-width panel that expands directly below the toolbar (pushing the
 * video grid down) instead of floating over it as a popover -- an inline
 * "space", animated open/shut with a height+opacity transition. */
function FiltersPanel({
  open,
  platform,
  timeWindow,
  onTimeWindowChange,
  filters,
  onApply,
  onClear,
}: {
  open: boolean;
  platform: VideoPlatformFilter;
  timeWindow: VideoTimeWindow;
  onTimeWindowChange: (window: VideoTimeWindow) => void;
  filters: VideoRangeFilters;
  onApply: (filters: VideoRangeFilters) => void;
  onClear: () => void;
}) {
  const [pending, setPending] = useState<VideoRangeFilters>(filters);
  const [pendingWindow, setPendingWindow] = useState<VideoTimeWindow>(timeWindow);

  // TikTok has no region concept -- a selected country only ever narrows
  // the YouTube slice of results (see the /api/niches/[niche]/videos OR
  // clause). Once the platform pill switches away from YouTube, any
  // in-progress country selection is dropped rather than left silently
  // inert and hidden.
  const [lastPlatform, setLastPlatform] = useState(platform);
  if (platform !== lastPlatform) {
    setLastPlatform(platform);
    if (platform !== "youtube" && pending.countries.length > 0) {
      setPending((prev) => ({ ...prev, countries: [] }));
    }
  }

  // Re-sync the working draft to the last-applied filters every time the
  // panel opens, so closing it without hitting Apply never leaks a
  // half-edited draft into the next time it's opened. Adjusted during
  // render (React's sanctioned way to derive state from a prop transition)
  // rather than in an effect, so it happens in the same commit instead of
  // flashing the stale draft for one frame.
  const [wasOpen, setWasOpen] = useState(open);
  // While the height animation is running, the panel needs overflow-hidden
  // so the grid doesn't visibly poke out of its still-growing/shrinking
  // box. But that same overflow-hidden clips the Country/Publishing Date
  // dropdowns once they're open -- so it's dropped the instant the panel
  // finishes expanding (and reinstated the instant a close is requested,
  // ahead of the collapse animation) rather than staying on permanently.
  const [settled, setSettled] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPending(filters);
      setPendingWindow(timeWindow);
    } else {
      setSettled(false);
    }
  }

  function handleApply() {
    onApply(pending);
    onTimeWindowChange(pendingWindow);
  }

  function handleResetAll() {
    setPending(EMPTY_VIDEO_RANGE_FILTERS);
    setPendingWindow("all");
    onClear();
    onTimeWindowChange("all");
  }

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="filters-panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={() => open && setSettled(true)}
          className={settled ? "overflow-visible" : "overflow-hidden"}
        >
          <div className="border-t border-hairline pb-5 pt-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RangeFilterCard
                label="Views"
                rangeLabel="Range (0-10M+)"
                formatValue={formatNumber}
                minBoundLabel="0"
                maxBoundLabel="10M+"
                boundMin={0}
                boundMax={10_000_000}
                step={10_000}
                breakpoints={VIEWS_BREAKPOINTS}
                minValue={pending.viewsMin}
                maxValue={pending.viewsMax}
                onChange={(min, max) => setPending((prev) => ({ ...prev, viewsMin: min, viewsMax: max }))}
                onReset={() => setPending((prev) => ({ ...prev, viewsMin: "", viewsMax: "" }))}
              />
              <RangeFilterCard
                label="Subscribers"
                rangeLabel="Range (0-10M+)"
                formatValue={formatNumber}
                minBoundLabel="0"
                maxBoundLabel="10M+"
                boundMin={0}
                boundMax={10_000_000}
                step={10_000}
                breakpoints={VIEWS_BREAKPOINTS}
                minValue={pending.followersMin}
                maxValue={pending.followersMax}
                onChange={(min, max) => setPending((prev) => ({ ...prev, followersMin: min, followersMax: max }))}
                onReset={() => setPending((prev) => ({ ...prev, followersMin: "", followersMax: "" }))}
              />
              {/* YouTube-only -- see the lastPlatform effect above. */}
              {platform === "youtube" && (
                <CountryFilterCard
                  selected={pending.countries}
                  onChange={(countries) => setPending((prev) => ({ ...prev, countries }))}
                  onReset={() => setPending((prev) => ({ ...prev, countries: [] }))}
                />
              )}
              <PublishingDateCard value={pendingWindow} onChange={setPendingWindow} onReset={() => setPendingWindow("all")} />
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
              <button type="button" onClick={handleResetAll} className="text-xs font-semibold text-body hover:text-heading">
                Reset all
              </button>
              <Button type="button" size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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

/** Shared by the sticky top bar and the bottom-of-grid rail so paging works
 * the same way (and looks the same) whichever one the user reaches for. */
export function PaginationControls({
  page,
  hasMore,
  onPageChange,
}: {
  page: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
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
  );
}

export function NicheTopBar({
  query,
  onQueryChange,
  onSearchSubmit,
  queryError,
  platform,
  onPlatformChange,
  timeWindow,
  onTimeWindowChange,
  rangeFilters,
  onApplyRangeFilters,
  onClearRangeFilters,
  sort,
  onSortChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  /** Subtle inline note shown under the search box when the last submit was
   * rejected client-side (see isPlainTextSafe's gate in NicheFinder.tsx) --
   * intentionally quiet, not a hard error banner, since this is just a
   * search box. */
  queryError?: string | null;
  platform: VideoPlatformFilter;
  onPlatformChange: (platform: VideoPlatformFilter) => void;
  timeWindow: VideoTimeWindow;
  onTimeWindowChange: (window: VideoTimeWindow) => void;
  rangeFilters: VideoRangeFilters;
  onApplyRangeFilters: (filters: VideoRangeFilters) => void;
  onClearRangeFilters: () => void;
  sort: VideoSort;
  onSortChange: (sort: VideoSort) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = countActiveRangeFilters(rangeFilters) + (timeWindow !== "all" ? 1 : 0);

  // Country only ever narrows YouTube results (TikTok has no region
  // concept) -- once the pill switches away from YouTube, drop any applied
  // country filter too, so "Filters (1)" can never point at a field that's
  // no longer shown anywhere in the panel.
  function handlePlatformChange(next: VideoPlatformFilter) {
    onPlatformChange(next);
    if (next !== "youtube" && rangeFilters.countries.length > 0) {
      onApplyRangeFilters({ ...rangeFilters, countries: [] });
    }
  }

  return (
    <div className="sticky top-0 z-20 -mx-4 bg-app px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
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
            maxLength={SHORT_TEXT_MAX}
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
          {queryError && (
            <p className="absolute left-1 top-full mt-1 text-[11px] font-medium text-body/60">{queryError}</p>
          )}
        </form>

        <button type="button" onClick={onSearchSubmit} className={cn(TOOLBAR_BUTTON, "bg-app")}>
          Search
        </button>

        <FiltersToggleButton
          open={filtersOpen}
          activeCount={activeFilterCount}
          onClick={() => setFiltersOpen((prev) => !prev)}
        />

        <PresetsDropdown />

        <SegmentedControl ariaLabel="Platform" items={PLATFORM_PILLS} value={platform} onChange={handlePlatformChange} />
      </div>

      <div className="flex items-center gap-2 border-t border-hairline/70 py-2 text-xs text-subtle">
        <SortDropdown sort={sort} onSortChange={onSortChange} />
      </div>

      <FiltersPanel
        open={filtersOpen}
        platform={platform}
        timeWindow={timeWindow}
        onTimeWindowChange={onTimeWindowChange}
        filters={rangeFilters}
        onApply={(filters) => {
          onApplyRangeFilters(filters);
          setFiltersOpen(false);
        }}
        onClear={onClearRangeFilters}
      />
    </div>
  );
}
