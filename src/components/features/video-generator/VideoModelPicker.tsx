"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { POPULAR_VIDEO_MODEL_IDS, VIDEO_MODELS, type VideoModelConfig } from "@/lib/config/video-models";

function ModelIcon({ model }: { model: VideoModelConfig }) {
  if (model.logo) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-900/[0.04] dark:bg-white/[0.06] dark:ring-white/[0.06]">
        <Image src={model.logo} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 ring-1 ring-slate-900/[0.04] dark:bg-white/[0.06] dark:text-slate-400 dark:ring-white/[0.06]">
      {model.id.slice(0, 1)}
    </span>
  );
}

interface VideoModelPickerProps {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Searchable, grouped (Popular/More) model picker -- the video catalog is
 * too large (8 models across 4 price tiers) for PillDropdown's flat list to
 * stay scannable, unlike the image tool's 5-model dropdown. Mirrors the
 * competitor screenshot's picker shape while staying an honestly flat list
 * (no fake family-expansion affordance for entries with nothing behind
 * them yet -- see video-models.ts's catalog comment).
 */
export function VideoModelPicker({ value, onChange, className }: VideoModelPickerProps) {
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

  const current = VIDEO_MODELS.find((model) => model.id === value);

  const { popular, more } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? VIDEO_MODELS.filter((model) => model.id.toLowerCase().includes(q) || model.description.toLowerCase().includes(q))
      : VIDEO_MODELS;
    return {
      popular: filtered.filter((model) => POPULAR_VIDEO_MODEL_IDS.includes(model.id)),
      more: filtered.filter((model) => !POPULAR_VIDEO_MODEL_IDS.includes(model.id)),
    };
  }, [query]);

  function renderRow(model: VideoModelConfig) {
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
        className={cn(
          "group flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium shadow-sm outline-none transition-colors duration-150 active:scale-[0.97]",
          "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          "dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-slate-200 dark:shadow-none dark:hover:border-white/[0.12] dark:hover:bg-white/[0.1]",
          "focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-blue-500/40 dark:focus-visible:ring-offset-zinc-950",
          open && "border-blue-400 bg-blue-50/60 dark:border-blue-400/50 dark:bg-blue-500/10"
        )}
      >
        {current && <ModelIcon model={current} />}
        <span className="tracking-[-0.01em]">{current?.id ?? value}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500",
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
            className={cn(
              "absolute left-0 top-full z-50 mt-2 flex max-h-96 w-72 origin-top-left flex-col overflow-hidden rounded-2xl",
              "border border-slate-200/70 bg-white/95 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl",
              "dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.03)]"
            )}
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
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    More
                  </p>
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
