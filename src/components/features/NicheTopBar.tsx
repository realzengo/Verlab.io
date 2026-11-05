"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Search,
  SlidersHorizontal,
  VenetianMask,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { Switch } from "@/components/ui/Switch";
import { useNicheSidebar } from "@/components/dashboard/NicheSidebarContext";
import { cn, formatNumber } from "@/lib/utils";
import { SHORT_TEXT_MAX } from "@/lib/validation";

export type VideoPlatformFilter = "all" | "tiktok" | "youtube";
export type VideoTimeWindow = "all" | "24h" | "7d" | "30d" | "90d" | "365d";

/** The feed's starting window. Must match DEFAULT_FEED_WINDOW_DAYS in
 * src/lib/server/trending-videos.ts, which renders the first page on the
 * server. Not counted as an active filter while it's still the default. */
export const DEFAULT_VIDEO_TIME_WINDOW: VideoTimeWindow = "90d";
export type VideoSort = "views" | "newest";

export interface VideoRangeFilters {
  viewsMin: string;
  viewsMax: string;
  followersMin: string;
  followersMax: string;
  /** How many times a video's views beat the average of what's currently
   * matching, as a multiplier -- the "did this actually break out" dial, as
   * opposed to raw views (a 2M-view video on a channel whose videos all do
   * 2M isn't an outlier; a 2M-view video among 50K ones is). Computed
   * server-side, see outlierMin/outlierMax in niche-video-query.ts. */
  outlierMin: string;
  outlierMax: string;
  /** Views ÷ hours since posted -- how fast it's climbing right now, which
   * catches something 6 hours old on its way to viral that a raw view floor
   * would miss entirely. */
  viewsPerHourMin: string;
  viewsPerHourMax: string;
  /** 2-letter YouTube region codes; empty means worldwide. */
  countries: string[];
  /** AI-verified "no real face on camera" — matched by channel name against
   * the niche_channels classifier (see getFacelessAuthorSet in
   * niche-video-query.ts). A channel that's never been submitted for
   * classification won't match, even if its content is genuinely faceless. */
  faceless: boolean;
}

export const EMPTY_VIDEO_RANGE_FILTERS: VideoRangeFilters = {
  viewsMin: "",
  viewsMax: "",
  followersMin: "",
  followersMax: "",
  outlierMin: "",
  outlierMax: "",
  viewsPerHourMin: "",
  viewsPerHourMax: "",
  countries: [],
  faceless: false,
};

export function countActiveRangeFilters(filters: VideoRangeFilters): number {
  const { countries, faceless, ...ranges } = filters;
  return Object.values(ranges).filter(Boolean).length + (countries.length > 0 ? 1 : 0) + (faceless ? 1 : 0);
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

// Quiet chrome shared by every toolbar trigger (Filters, Niches, Sort) --
// hairline + fill only, no shadow and no brand-blue at rest, so the
// thumbnails below stay the loudest thing on the page. `data-open` keeps a
// trigger pressed while its menu or panel is open.
const TOOLBAR_BUTTON =
  "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill) data-[open=true]:bg-(--app-fill-strong) dark:bg-white/[0.03]";
const TOOLBAR_BUTTON_ICON = "h-4 w-4 shrink-0 text-subtle";

const MENU_PANEL = "absolute top-[calc(100%+6px)] z-30 rounded-xl border border-hairline bg-surface p-1 shadow-card-hover";
const MENU_ROW =
  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-(--app-fill)";

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
  stretchBelowXl = false,
}: {
  ariaLabel: string;
  items: { id: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
  /** On a phone-width toolbar (below its container's @xl), take a full row
   * of its own as the last line, segments sharing the width evenly. */
  stretchBelowXl?: boolean;
}) {
  const layoutId = useId();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg bg-(--app-fill) p-[3px]",
        stretchBelowXl && "order-last w-full @xl:order-none @xl:w-auto"
      )}
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
            className={cn(
              "relative flex h-full cursor-pointer items-center whitespace-nowrap rounded-md px-3 text-[13px] font-medium",
              stretchBelowXl && "flex-1 justify-center @xl:flex-none"
            )}
          >
            {isActive && (
              <motion.span
                layoutId={`${layoutId}-active`}
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
                className="absolute inset-0 rounded-md bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_1px_rgba(16,24,40,0.04)] dark:bg-white/[0.1] dark:shadow-none"
              />
            )}
            <span
              className={cn(
                "relative z-10 flex items-center gap-1.5 transition-colors",
                isActive ? "text-heading" : "text-subtle hover:text-heading"
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
    <div className="rounded-xl border border-hairline p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-heading">{label}</p>
        <button
          type="button"
          onClick={onReset}
          disabled={!active}
          className="cursor-pointer text-xs font-medium text-body transition-colors hover:text-heading disabled:pointer-events-none disabled:opacity-40"
        >
          Reset
        </button>
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-subtle">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** A FilterCard wrapping a dual-handle RangeSlider -- shared by Outlier
 * Score, Views, and Subscribers. The handle at either bound (boundMin/
 * boundMax) is treated as "unbounded" and clears to "" rather than sending
 * the literal edge number, matching the "10M+" style open-ended labels
 * shown under the track. */
// Views/Subscribers deliberately aren't built from a formula -- the low end
// covers 0 up to just under 1M with increasingly large "nice" steps (most of
// a real video's view count lives here, so it gets the fine control), then a
// flat 500K ramp through the 1M-10M tier, then a widening tail up to 100M.
// The tail matters: the track used to stop at 10M, which meant "only show me
// videos over 10M views" was the most selective thing anyone could ask for,
// and there was no way at all to say "20M+" -- on TikTok and YouTube Shorts,
// where a genuine breakout hit routinely clears 50M, that's not the top of
// the market, it's the middle of it.
const VIEWS_LOW_HALF = [
  0, 10, 50, 100, 200, 400, 600, 800, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 750_000,
];
const VIEWS_MID_TIER = Array.from({ length: 19 }, (_, i) => 1_000_000 + i * 500_000);
const VIEWS_TOP_TIER = [
  12_500_000, 15_000_000, 17_500_000, 20_000_000, 25_000_000, 30_000_000, 40_000_000, 50_000_000, 75_000_000,
  100_000_000,
];
const VIEWS_BREAKPOINTS = [...VIEWS_LOW_HALF, ...VIEWS_MID_TIER, ...VIEWS_TOP_TIER];

// Outlier multiplier: how far a video's views beat the average of what's
// currently matching. 1x is "dead average", so the useful range starts just
// above it -- 0 is the "no filter" bound, not a meaningful multiplier.
const OUTLIER_BREAKPOINTS = [
  0, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100,
];

// Views per hour since posting -- momentum rather than total size. A 3-hour-
// old video at 30K/hr is on a far steeper curve than a month-old one sitting
// at 5M, and only this dial can tell them apart.
const VIEWS_PER_HOUR_BREAKPOINTS = [
  0, 100, 250, 500, 1_000, 2_000, 3_000, 5_000, 7_500, 10_000, 15_000, 25_000, 50_000, 75_000, 100_000, 250_000,
  500_000, 1_000_000,
];

// 1.5 reads as "1.5x", 20 as "20x" -- no trailing ".0" on whole multipliers.
function formatOutlier(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0$/, "")}x`;
}

function formatViewsPerHour(value: number): string {
  return `${formatNumber(value)}/hr`;
}

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

function FacelessFilterCard({
  checked,
  onChange,
  onReset,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onReset: () => void;
}) {
  return (
    <FilterCard label="Faceless only" active={checked} onReset={onReset}>
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-body">
          <VenetianMask className="h-4 w-4 shrink-0 text-body/60" />
          No real face on camera
        </span>
        <Switch checked={checked} onCheckedChange={onChange} label="Faceless only" size="sm" />
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
    <button type="button" onClick={onClick} aria-expanded={open} data-open={open} className={TOOLBAR_BUTTON}>
      <SlidersHorizontal className={TOOLBAR_BUTTON_ICON} />
      Filters
      {activeCount > 0 && (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold tabular-nums text-white">
          {activeCount}
        </span>
      )}
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
    setPendingWindow(DEFAULT_VIDEO_TIME_WINDOW);
    onClear();
    onTimeWindowChange(DEFAULT_VIDEO_TIME_WINDOW);
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
                rangeLabel="Range (0-100M+)"
                formatValue={formatNumber}
                minBoundLabel="0"
                maxBoundLabel="100M+"
                boundMin={0}
                boundMax={100_000_000}
                step={10_000}
                breakpoints={VIEWS_BREAKPOINTS}
                minValue={pending.viewsMin}
                maxValue={pending.viewsMax}
                onChange={(min, max) => setPending((prev) => ({ ...prev, viewsMin: min, viewsMax: max }))}
                onReset={() => setPending((prev) => ({ ...prev, viewsMin: "", viewsMax: "" }))}
              />
              <RangeFilterCard
                label="Subscribers"
                rangeLabel="Range (0-100M+)"
                formatValue={formatNumber}
                minBoundLabel="0"
                maxBoundLabel="100M+"
                boundMin={0}
                boundMax={100_000_000}
                step={10_000}
                breakpoints={VIEWS_BREAKPOINTS}
                minValue={pending.followersMin}
                maxValue={pending.followersMax}
                onChange={(min, max) => setPending((prev) => ({ ...prev, followersMin: min, followersMax: max }))}
                onReset={() => setPending((prev) => ({ ...prev, followersMin: "", followersMax: "" }))}
              />
              {/* Both of these were already fully implemented server-side
                  (outlierMin/Max and viewsPerHourMin/Max in
                  niche-video-query.ts) and simply had no control wired to
                  them, so nothing ever sent them -- the two dials that
                  actually isolate breakout content were dead code. */}
              <RangeFilterCard
                label="Outlier score"
                rangeLabel="How far above average (1x-100x+)"
                formatValue={formatOutlier}
                minBoundLabel="Any"
                maxBoundLabel="100x+"
                boundMin={0}
                boundMax={100}
                step={1}
                breakpoints={OUTLIER_BREAKPOINTS}
                minValue={pending.outlierMin}
                maxValue={pending.outlierMax}
                onChange={(min, max) => setPending((prev) => ({ ...prev, outlierMin: min, outlierMax: max }))}
                onReset={() => setPending((prev) => ({ ...prev, outlierMin: "", outlierMax: "" }))}
              />
              <RangeFilterCard
                label="Views per hour"
                rangeLabel="Momentum since posting (0-1M/hr+)"
                formatValue={formatViewsPerHour}
                minBoundLabel="Any"
                maxBoundLabel="1M/hr+"
                boundMin={0}
                boundMax={1_000_000}
                step={100}
                breakpoints={VIEWS_PER_HOUR_BREAKPOINTS}
                minValue={pending.viewsPerHourMin}
                maxValue={pending.viewsPerHourMax}
                onChange={(min, max) =>
                  setPending((prev) => ({ ...prev, viewsPerHourMin: min, viewsPerHourMax: max }))
                }
                onReset={() => setPending((prev) => ({ ...prev, viewsPerHourMin: "", viewsPerHourMax: "" }))}
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
              <FacelessFilterCard
                checked={pending.faceless}
                onChange={(faceless) => setPending((prev) => ({ ...prev, faceless }))}
                onReset={() => setPending((prev) => ({ ...prev, faceless: false }))}
              />
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
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-open={open}
        className={TOOLBAR_BUTTON}
      >
        <Layers className={TOOLBAR_BUTTON_ICON} />
        <span className="max-w-[140px] truncate">{activeNiche ?? "All niches"}</span>
        <ChevronDown className={cn(TOOLBAR_BUTTON_ICON, "transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className={cn(MENU_PANEL, "left-0 max-h-80 w-60 overflow-y-auto")}>
          <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
            <p className="text-xs font-medium text-subtle">Niches</p>
            {activeNiche && (
              <button
                type="button"
                onClick={() => {
                  clear();
                  setOpen(false);
                }}
                className="cursor-pointer text-xs font-medium text-body hover:text-heading"
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
                className={cn(MENU_ROW, isActive ? "font-medium text-heading" : "text-body hover:text-heading")}
              >
                <span className="truncate">{niche}</span>
                {isActive ? (
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  typeof count === "number" &&
                  count > 0 && <span className="shrink-0 text-xs tabular-nums text-subtle">{formatNumber(count)}</span>
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

  // ml-auto: when the toolbar wraps, Sort sits at the right end of its row,
  // so its right-anchored menu always opens on screen. On a phone-width bar
  // it drops to its icon (the menu still names the order).
  return (
    <div ref={containerRef} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Sort by ${activeLabel}`}
        data-open={open}
        className={TOOLBAR_BUTTON}
      >
        <ArrowUpDown className={TOOLBAR_BUTTON_ICON} />
        <span className="hidden @lg:inline">{activeLabel}</span>
        <ChevronDown className={cn(TOOLBAR_BUTTON_ICON, "transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className={cn(MENU_PANEL, "right-0 w-44")}>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onSortChange(option.id);
                setOpen(false);
              }}
              className={cn(MENU_ROW, option.id === sort ? "font-medium text-heading" : "text-body hover:text-heading")}
            >
              {option.label}
              {option.id === sort && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
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
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className={cn(TOOLBAR_BUTTON, "h-8 pl-2 pr-2.5 text-body hover:text-heading disabled:pointer-events-none disabled:opacity-40")}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </button>
      <span className="min-w-14 text-center text-[13px] tabular-nums text-subtle">Page {page}</span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasMore}
        aria-label="Next page"
        className={cn(TOOLBAR_BUTTON, "h-8 pl-2.5 pr-2 text-body hover:text-heading disabled:pointer-events-none disabled:opacity-40")}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function NicheTopBar({
  query,
  onQueryChange,
  onSearchSubmit,
  queryError,
  loading,
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
  /** Swaps the search icon for a spinner while a fetch triggered by this
   * bar (submit, filter/sort change, page change) is in flight. */
  loading?: boolean;
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
  const activeFilterCount =
    countActiveRangeFilters(rangeFilters) + (timeWindow !== "all" && timeWindow !== DEFAULT_VIDEO_TIME_WINDOW ? 1 : 0);

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
    <div className="sticky top-0 z-20 -mx-4 bg-surface px-4 dark:bg-[#000000] sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
      {/* Search, then every control that narrows or orders the feed: one
          row once the page is wide enough, the field over the controls
          below that. Breakpoints are container queries on NicheFinder's
          section, since the sidebar decides how wide this bar really is.
          Submitting is Enter (the phone keyboard's Search key, via
          enterKeyHint) rather than a separate button beside the field. */}
      <div className="flex flex-wrap items-center gap-2 py-3">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
          className="relative w-full @4xl:w-auto @4xl:min-w-[240px] @4xl:flex-1"
        >
          {loading ? (
            <Loader2 className={cn(TOOLBAR_BUTTON_ICON, "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 animate-spin")} />
          ) : (
            <Search className={cn(TOOLBAR_BUTTON_ICON, "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2")} />
          )}
          <input
            type="text"
            enterKeyHint="search"
            aria-label="Search videos"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search videos, creators, hashtags…"
            maxLength={SHORT_TEXT_MAX}
            className="h-9 w-full rounded-lg border border-hairline bg-surface pl-9 pr-8 text-[13px] text-heading transition-[border-color,box-shadow] placeholder:text-subtle focus:border-heading/25 focus:outline-none focus:ring-3 focus:ring-heading/[0.06] dark:bg-white/[0.03] dark:focus:border-white/25 dark:focus:ring-white/[0.06]"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                onQueryChange("");
                onSearchSubmit();
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-subtle hover:bg-(--app-fill) hover:text-heading"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {queryError && (
            <p className="absolute left-1 top-full mt-1 text-[11px] font-medium text-subtle">{queryError}</p>
          )}
        </form>

        <FiltersToggleButton
          open={filtersOpen}
          activeCount={activeFilterCount}
          onClick={() => setFiltersOpen((prev) => !prev)}
        />

        <PresetsDropdown />

        <SegmentedControl
          ariaLabel="Platform"
          items={PLATFORM_PILLS}
          value={platform}
          onChange={handlePlatformChange}
          stretchBelowXl
        />

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
