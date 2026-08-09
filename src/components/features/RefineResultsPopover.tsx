"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/utils";

export interface RefineFilters {
  viewsMin: string;
  viewsMax: string;
  followersMin: string;
  followersMax: string;
  postedAfter: string;
  postedBefore: string;
}

export const EMPTY_REFINE_FILTERS: RefineFilters = {
  viewsMin: "",
  viewsMax: "",
  followersMin: "",
  followersMax: "",
  postedAfter: "",
  postedBefore: "",
};

export function hasActiveRefineFilters(filters: RefineFilters): boolean {
  return Object.values(filters).some((value) => value !== "");
}

const inputClass =
  "w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-body outline-none placeholder:text-subtle focus:border-success focus:ring-2 focus:ring-success/40";
const sectionLabelClass = "mb-2 text-xs font-bold uppercase tracking-wide text-body";

function NumberRangeSection({
  label,
  minValue,
  maxValue,
  minPlaceholder,
  maxPlaceholder,
  onMinChange,
  onMaxChange,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  minPlaceholder: string;
  maxPlaceholder: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  return (
    <div>
      <p className={sectionLabelClass}>{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={minValue}
          onChange={(e) => onMinChange(e.target.value)}
          placeholder={minPlaceholder}
          aria-label={`${label} minimum`}
          className={inputClass}
        />
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={maxValue}
          onChange={(e) => onMaxChange(e.target.value)}
          placeholder={maxPlaceholder}
          aria-label={`${label} maximum`}
          className={inputClass}
        />
      </div>
    </div>
  );
}

/**
 * "Refine results" filter popover for the Top Trending Videos section --
 * range-filters real per-video signals (views, the video's channel's real
 * subscriber count, and real posted date) already captured by the
 * TikTok/YouTube discovery pipelines. Draft state only commits to the
 * caller on "Apply"; "Clear" resets both.
 */
export function RefineResultsPopover({
  applied,
  onApply,
}: {
  applied: RefineFilters;
  onApply: (filters: RefineFilters) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<RefineFilters>(applied);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function openPopover() {
    setDraft(applied);
    setIsOpen(true);
  }

  function handleClear() {
    setDraft(EMPTY_REFINE_FILTERS);
    onApply(EMPTY_REFINE_FILTERS);
    setIsOpen(false);
  }

  function handleApply() {
    onApply(draft);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openPopover())}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-hairline bg-app px-4 py-1.5 text-sm font-medium text-body transition-colors hover:text-heading",
          hasActiveRefineFilters(applied) && "border-success/40 text-success"
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-80 rounded-card-lg border border-hairline bg-surface p-5 shadow-card-hover"
          >
            <div className="mb-4">
              <h3 className="text-lg font-bold text-heading">Refine results</h3>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-subtle">Adjust feed filters</p>
            </div>

            <div className="flex flex-col gap-4">
              <NumberRangeSection
                label="Views"
                minValue={draft.viewsMin}
                maxValue={draft.viewsMax}
                minPlaceholder="e.g. 100000"
                maxPlaceholder="e.g. 1000000"
                onMinChange={(v) => setDraft((prev) => ({ ...prev, viewsMin: v }))}
                onMaxChange={(v) => setDraft((prev) => ({ ...prev, viewsMax: v }))}
              />
              <NumberRangeSection
                label="Followers"
                minValue={draft.followersMin}
                maxValue={draft.followersMax}
                minPlaceholder="e.g. 1000"
                maxPlaceholder="e.g. 1000000"
                onMinChange={(v) => setDraft((prev) => ({ ...prev, followersMin: v }))}
                onMaxChange={(v) => setDraft((prev) => ({ ...prev, followersMax: v }))}
              />
              <div>
                <p className={sectionLabelClass}>Posting window</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">After</p>
                    <DatePicker
                      value={draft.postedAfter}
                      onChange={(v) => setDraft((prev) => ({ ...prev, postedAfter: v }))}
                      placeholder="Any"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">Before</p>
                    <DatePicker
                      value={draft.postedBefore}
                      onChange={(v) => setDraft((prev) => ({ ...prev, postedBefore: v }))}
                      placeholder="Any"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <button type="button" onClick={handleClear} className="text-sm font-medium text-subtle hover:text-body">
                Clear
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="rounded-lg bg-success px-5 py-2 text-sm font-bold text-white transition-colors hover:brightness-95"
              >
                Apply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
