"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FrameImageGenerateModal } from "./FrameImageGenerateModal";

export interface FrameSlotState {
  dataUrl: string | null;
  mode: "upload" | "ai";
}

export const EMPTY_FRAME_SLOT: FrameSlotState = { dataUrl: null, mode: "upload" };

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export const MAX_FRAME_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * A single docked drop-zone tile -- mirrors the competitor's "Start frame" /
 * "End frame" squares that sit beside the prompt textarea, instead of
 * burying first/last-frame conditioning inside a generic "Images" popover.
 * Clicking an empty tile opens the same upload/AI-generate popover as
 * before; a filled tile shows the thumbnail with a hover-to-remove overlay.
 */
function FrameBox({
  label,
  frameLabel,
  slot,
  onChange,
  aspectRatio,
}: {
  label: string;
  frameLabel: "first frame" | "last frame";
  slot: FrameSlotState;
  onChange: (next: FrameSlotState) => void;
  aspectRatio: string;
}) {
  const [open, setOpen] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
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
    <div ref={containerRef} className="relative">
      {slot.dataUrl ? (
        <div className="group/frame relative h-28 w-20 shrink-0 overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
          <img src={slot.dataUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 group-hover/frame:bg-black/40 group-hover/frame:opacity-100">
            <button
              type="button"
              onClick={() => onChange({ ...slot, dataUrl: null })}
              aria-label={`Remove ${label.toLowerCase()}`}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm hover:bg-slate-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1.5 pt-3 text-[11px] font-semibold text-white">
            {label}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className={cn(
            "flex h-28 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-1.5 text-center text-xs font-medium transition-colors duration-150",
            "border-slate-300 text-slate-400 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-500",
            "dark:border-zinc-700 dark:text-slate-500 dark:hover:border-blue-400/50 dark:hover:bg-blue-500/[0.06] dark:hover:text-blue-400",
            open && "border-blue-400 bg-blue-50/60 text-blue-500 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-400"
          )}
        >
          <ImagePlus className="h-5 w-5" />
          <span className="leading-tight">{label}</span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute right-0 top-full z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border p-1.5",
              "border-slate-200/70 bg-white/95 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl",
              "dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.03)]"
            )}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowGenerateModal(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-slate-400" />
              AI Generate
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                fileInputRef.current?.click();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              <Upload className="h-4 w-4 shrink-0 text-slate-400" />
              Upload
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_FRAME_IMAGE_BYTES) return;
                onChange({ dataUrl: await readFileAsDataUrl(file), mode: "upload" });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showGenerateModal && (
        <FrameImageGenerateModal
          frameLabel={frameLabel}
          defaultAspectRatio={aspectRatio}
          onClose={() => setShowGenerateModal(false)}
          onSelect={(dataUrl) => {
            onChange({ dataUrl, mode: "ai" });
            setShowGenerateModal(false);
          }}
        />
      )}
    </div>
  );
}

interface FrameImagePickerProps {
  startFrame: FrameSlotState;
  onStartFrameChange: (next: FrameSlotState) => void;

  endFrame: FrameSlotState;
  onEndFrameChange: (next: FrameSlotState) => void;
  supportsEndFrame: boolean;

  /** Video's currently selected aspect ratio -- seeds the AI Generate modal so the frame image matches. */
  aspectRatio: string;
}

/**
 * Docked "Start frame" / "End frame" tiles -- mirrors the competitor's
 * layout of pinning first/last-frame conditioning next to the prompt box
 * instead of a row pill, since it's the primary input for image-to-video
 * rather than a secondary option. Each slot can be uploaded directly or
 * generated via the full-screen AI Generate modal (FrameImageGenerateModal).
 */
export function FrameImagePicker({
  startFrame,
  onStartFrameChange,
  endFrame,
  onEndFrameChange,
  supportsEndFrame,
  aspectRatio,
}: FrameImagePickerProps) {
  return (
    <div className="flex shrink-0 gap-2">
      <FrameBox label="Start frame" frameLabel="first frame" slot={startFrame} onChange={onStartFrameChange} aspectRatio={aspectRatio} />
      {supportsEndFrame && (
        <FrameBox label="End frame" frameLabel="last frame" slot={endFrame} onChange={onEndFrameChange} aspectRatio={aspectRatio} />
      )}
    </div>
  );
}
