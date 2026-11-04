"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import presets from "@/lib/config/clone-presets.json";

export interface ClonePreset {
  id: string;
  name: string;
  tagline: string;
}

/** Static file each preset was rendered to by scripts/generate-clone-presets.mjs. */
export function clonePresetImagePath(id: string): string {
  return `/clone-presets/${id}.jpg`;
}

/**
 * The Clone composer's "Preset character" picker -- a fixed set of original,
 * fictional characters bundled under public/clone-presets (see
 * clone-presets.json for how each was prompted).
 */
export function ClonePresetPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (preset: ClonePreset) => void }) {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target only exists client-side
    setPortalTarget(document.body);
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-preset-title"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#131318]"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/[0.06]">
          <div>
            <h2 id="clone-preset-title" className="text-base font-semibold text-slate-900 dark:text-white">
              Preset characters
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Pick a character to drop into your video.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 overflow-y-auto p-6 sm:grid-cols-4">
          {(presets as ClonePreset[]).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset)}
              className="group text-left outline-none"
            >
              <span className="relative block aspect-[9/16] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200 transition-all duration-200 group-hover:ring-2 group-hover:ring-blue-400 group-focus-visible:ring-2 group-focus-visible:ring-blue-400 dark:bg-white/[0.04] dark:ring-white/[0.08]">
                <Image
                  src={clonePresetImagePath(preset.id)}
                  alt={preset.name}
                  fill
                  sizes="(min-width: 640px) 180px, 45vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </span>
              <span className="mt-2 block text-sm font-semibold text-slate-900 dark:text-white">{preset.name}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{preset.tagline}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>,
    portalTarget
  );
}
