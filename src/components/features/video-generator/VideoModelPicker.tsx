"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Lock, Search } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TRAY_CHIP, TRAY_CHIP_OPEN, TRAY_ICON_TILE, TRAY_PANEL } from "@/components/ui/PillDropdown";

export interface ModelPickerOption {
  id: string;
  description: string;
  logo?: string;
  /** Logo is already a filled square/circular app icon (own background, no transparent margin) -- render it filling the whole avatar circle instead of as a small centered glyph. */
  logoFullBleed?: boolean;
  /** Only selectable on the Pro (or higher) plan -- see VideoModelPickerProps.isPro. */
  requiresPro?: boolean;
  /** Only selectable on the Scale plan -- see VideoModelPickerProps.isScale. */
  requiresScale?: boolean;
}

/**
 * A model's logo. `tile` draws it as a small app-icon tile (the composer
 * tray's look) instead of the round avatar the phone panels use.
 */
export function ModelIcon({ model, small, tile }: { model: ModelPickerOption; small?: boolean; tile?: boolean }) {
  const wrapperSize = small ? "h-5 w-5" : "h-8 w-8";
  const glyphSize = small ? 11 : 16;

  if (tile) {
    const tileShape = small ? "h-[18px] w-[18px] rounded-[5px]" : "h-7 w-7 rounded-lg";
    if (model.logo && model.logoFullBleed) {
      const px = small ? 18 : 28;
      return (
        <span className={cn("flex shrink-0 overflow-hidden ring-1 ring-black/[0.06] dark:ring-white/[0.08]", tileShape)}>
          <Image src={model.logo} alt="" width={px} height={px} className="h-full w-full object-cover" />
        </span>
      );
    }
    const tileGlyph = small ? 11 : 14;
    return (
      <span className={cn(TRAY_ICON_TILE, tileShape, !model.logo && "text-[10px] font-semibold text-subtle")}>
        {model.logo ? (
          <Image src={model.logo} alt="" width={tileGlyph} height={tileGlyph} className="shrink-0 object-contain" style={{ width: tileGlyph, height: tileGlyph }} />
        ) : (
          model.id.slice(0, 1)
        )}
      </span>
    );
  }

  if (model.logo && model.logoFullBleed) {
    const px = small ? 20 : 32;
    return (
      <span className={cn("flex shrink-0 overflow-hidden rounded-full ring-1 ring-slate-900/[0.04] dark:ring-white/[0.06]", wrapperSize)}>
        <Image src={model.logo} alt="" width={px} height={px} className="h-full w-full object-cover" />
      </span>
    );
  }

  if (model.logo) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-900/[0.04] dark:bg-white/[0.06] dark:ring-white/[0.06]",
          wrapperSize
        )}
      >
        <Image src={model.logo} alt="" width={glyphSize} height={glyphSize} className="shrink-0 object-contain" style={{ width: glyphSize, height: glyphSize }} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-500 ring-1 ring-slate-900/[0.04] dark:bg-white/[0.06] dark:text-slate-400 dark:ring-white/[0.06]",
        wrapperSize,
        small ? "text-[9px]" : "text-[11px]"
      )}
    >
      {model.id.slice(0, 1)}
    </span>
  );
}

interface VideoModelPickerProps<T extends ModelPickerOption> {
  value: string;
  onChange: (id: string) => void;
  models: T[];
  /** IDs shown under a "Popular" section above the rest, under "More" -- omit (or leave empty) for a small catalog that doesn't need grouping (e.g. Edit tab's models). */
  popularIds?: string[];
  /** Current user is on the Pro (or higher) plan -- unlocks rows with requiresPro. Defaults to false (locked) so callers that don't pass plan info fail closed rather than silently unlocking everything. */
  isPro?: boolean;
  /** Current user is on the Scale plan -- unlocks rows with requiresScale. Defaults to false (locked), same fail-closed reasoning as isPro. */
  isScale?: boolean;
  /** Called instead of onChange when a locked (requiresPro/requiresScale, isPro/isScale false) row is clicked. */
  onRequestUpgrade?: () => void;
  className?: string;
}

/**
 * Searchable, optionally grouped (Popular/More) model picker -- generic over
 * any model shape with id/description/logo so it serves both Create's large
 * catalog (VIDEO_MODELS, grouped) and Edit's small one (EDIT_VIDEO_MODELS,
 * flat) instead of duplicating this component per tab. Mirrors the
 * competitor screenshot's picker shape while staying an honestly flat list
 * (no fake family-expansion affordance for entries with nothing behind
 * them yet -- see video-models.ts's catalog comment).
 */
export function VideoModelPicker<T extends ModelPickerOption>({
  value,
  onChange,
  models,
  popularIds = [],
  isPro = false,
  isScale = false,
  onRequestUpgrade,
  className,
}: VideoModelPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => searchRef.current?.focus());

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const current = models.find((model) => model.id === value);
  const hasSections = popularIds.length > 0;

  const { popular, more } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? models.filter((model) => model.id.toLowerCase().includes(q) || model.description.toLowerCase().includes(q)) : models;
    if (!hasSections) return { popular: [], more: filtered };
    return {
      popular: filtered.filter((model) => popularIds.includes(model.id)),
      more: filtered.filter((model) => !popularIds.includes(model.id)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, models, hasSections]);

  function renderRow(model: T) {
    const selected = model.id === value;
    const locked = (Boolean(model.requiresPro) && !isPro) || (Boolean(model.requiresScale) && !isScale);
    const lockLabel = Boolean(model.requiresScale) && !isScale ? "Scale" : "Pro";
    return (
      <button
        key={model.id}
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => {
          if (locked) {
            onRequestUpgrade?.();
            setOpen(false);
            return;
          }
          onChange(model.id);
          setOpen(false);
        }}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors duration-150",
          selected ? "bg-[var(--app-fill)]" : "hover:bg-[var(--app-fill)]"
        )}
      >
        <span className={cn("flex", locked && "opacity-50")}>
          <ModelIcon model={model} tile />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("flex items-center gap-1.5 text-[13px] font-medium", locked ? "text-subtle" : "text-heading")}>
            {model.id}
            {locked && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-subtle">
                <Lock className="h-3 w-3" />
                {lockLabel}
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-subtle">{model.description}</span>
        </span>
        {selected && !locked && <Check className="h-3.5 w-3.5 shrink-0 text-[#335cff] dark:text-[#7d97ff]" />}
      </button>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open) setQuery("");
          setOpen((prev) => !prev);
        }}
        className={cn("group", TRAY_CHIP, open && TRAY_CHIP_OPEN)}
      >
        {current && <ModelIcon model={current} small tile />}
        <span>{current?.id ?? value}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-subtle transition-transform duration-200", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn("absolute left-0 top-full z-50 mt-2 flex max-h-96 w-80 origin-top-left flex-col overflow-hidden rounded-2xl", TRAY_PANEL)}
          >
            <div className="flex items-center gap-2 border-b border-[#EEF0F2] px-4 py-3 dark:border-white/[0.06]">
              <Search className="h-4 w-4 shrink-0 text-subtle" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search models"
                aria-label="Search models"
                className="w-full bg-transparent text-[13px] text-heading outline-none placeholder:text-subtle"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {popular.length > 0 && (
                <div className="mb-1">
                  <p className="px-2.5 pt-2 pb-1 text-xs font-medium text-subtle">
                    Popular
                  </p>
                  {popular.map(renderRow)}
                </div>
              )}
              {more.length > 0 && (
                <div>
                  {hasSections && (
                    <p className="px-2.5 pt-2 pb-1 text-xs font-medium text-subtle">
                      More
                    </p>
                  )}
                  {more.map(renderRow)}
                </div>
              )}
              {popular.length === 0 && more.length === 0 && (
                <p className="px-3 py-6 text-center text-[13px] text-subtle">No models match &ldquo;{query}&rdquo;</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
