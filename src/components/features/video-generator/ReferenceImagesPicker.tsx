"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ImagePlus, Images, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GLASS_PANEL, GLASS_PILL_ACTIVE, GLASS_PILL_BASE, GLASS_PILL_FOCUS, GLASS_PILL_IDLE } from "@/components/ui/PillDropdown";
import { readFileAsDataUrl } from "./FrameImagePicker";

const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;

interface ReferenceImagesPickerProps {
  images: string[];
  onChange: (next: string[]) => void;
  max: number;
  className?: string;
}

/**
 * The Edit tab's "Images" control -- lets the user attach up to `max`
 * reference images (addressed as @Image1, @Image2... in the edit prompt,
 * same @-reference syntax fal's Kling O1 edit endpoint expects -- see
 * EDIT_VIDEO_MODELS in video-models.ts). Deliberately upload-only (unlike
 * FrameImagePicker's start/end frame tiles, which also offer AI-generate) --
 * these are references to attach, not a new frame to create.
 */
export function ReferenceImagesPicker({ images, onChange, max, className }: ReferenceImagesPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn("group", GLASS_PILL_BASE, GLASS_PILL_IDLE, GLASS_PILL_FOCUS, open && GLASS_PILL_ACTIVE)}
      >
        <Images className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
        <span className="tracking-[-0.01em]">Images{images.length > 0 ? ` (${images.length})` : ""}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500", open && "rotate-180 text-blue-500 dark:text-blue-400")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn("absolute left-0 top-full z-50 mt-2 w-64 origin-top-left rounded-2xl p-3", GLASS_PANEL)}
          >
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Reference images (up to {max})</p>
            <div className="flex flex-wrap gap-2">
              {images.map((image, index) => (
                <div key={index} className="group/ref relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200 dark:ring-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
                  <img src={image} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onChange(images.filter((_, i) => i !== index))}
                    aria-label={`Remove reference image ${index + 1}`}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 group-hover/ref:bg-black/40 group-hover/ref:opacity-100"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ))}
              {images.length < max && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Add reference image"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-zinc-700 dark:text-slate-500 dark:hover:border-blue-400/50 dark:hover:text-blue-400"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (file.size > MAX_REFERENCE_IMAGE_BYTES) return;
                onChange([...images, await readFileAsDataUrl(file)]);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
