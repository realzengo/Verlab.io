"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GLASS_PANEL, GLASS_PILL_ACTIVE, GLASS_PILL_BASE, GLASS_PILL_FOCUS, GLASS_PILL_IDLE } from "@/components/ui/PillDropdown";

export interface ModelPickerOption {
  id: string;
  description: string;
  logo?: string;
  /** Logo is already a filled square/circular app icon (own background, no transparent margin) -- render it filling the whole avatar circle instead of as a small centered glyph. */
  logoFullBleed?: boolean;
}

export function ModelIcon({ model, small }: { model: ModelPickerOption; small?: boolean }) {
  const wrapperSize = small ? "h-5 w-5" : "h-8 w-8";
  const glyphSize = small ? 11 : 16;

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
    return (
      <button
        key={model.id}
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => {
          onChange(model.id);
          setOpen(false);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150",
          selected ? "bg-blue-500/10 dark:bg-blue-500/15" : "hover:bg-slate-100/80 dark:hover:bg-white/[0.06]"
        )}
      >
        <ModelIcon model={model} />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-sm font-semibold",
              selected ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"
            )}
          >
            {model.id}
          </span>
          <span className="block truncate text-xs text-slate-400">{model.description}</span>
        </span>
        {selected && <Check className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />}
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
        className={cn("group", GLASS_PILL_BASE, GLASS_PILL_IDLE, GLASS_PILL_FOCUS, open && GLASS_PILL_ACTIVE)}
      >
        {current && <ModelIcon model={current} small />}
        <span className="tracking-[-0.01em]">{current?.id ?? value}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500",
            open && "rotate-180 text-blue-500 dark:text-blue-400"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn("absolute left-0 top-full z-50 mt-2 flex max-h-96 w-72 origin-top-left flex-col overflow-hidden rounded-2xl", GLASS_PANEL)}
          >
            <div className="flex items-center gap-2 border-b border-slate-200/70 px-3 py-2.5 dark:border-white/[0.08]">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search models..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {popular.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Popular
                  </p>
                  {popular.map(renderRow)}
                </div>
              )}
              {more.length > 0 && (
                <div>
                  {hasSections && (
                    <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      More
                    </p>
                  )}
                  {more.map(renderRow)}
                </div>
              )}
              {popular.length === 0 && more.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">No models match &ldquo;{query}&rdquo;</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
