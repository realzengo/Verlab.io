"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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

const MAX_FRAME_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * A single docked drop-zone tile -- mirrors the competitor's "Start frame" /
 * "End frame" squares that sit beside the prompt textarea, instead of
 * burying first/last-frame conditioning inside a generic "Images" popover.
 * Clicking an empty tile opens the same upload/AI-generate popover as
 * before; a filled tile shows the thumbnail with a hover-to-remove overlay.
 */
function FrameBox({
  label,
  slot,
  onChange,
  isGenerating,
  onGenerate,
}: {
  label: string;
  slot: FrameSlotState;
  onChange: (next: FrameSlotState) => void;
  isGenerating: boolean;
  onGenerate: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
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
              "absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-2xl border p-3",
              "border-slate-200/70 bg-white/95 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl",
              "dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.03)]"
            )}
          >
            <div className="mb-2.5 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/[0.04]">
              <button
                type="button"
                onClick={() => onChange({ ...slot, mode: "ai" })}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
                  slot.mode === "ai"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                <Sparkles className="h-3 w-3" />
                AI Generate
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...slot, mode: "upload" })}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
                  slot.mode === "upload"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                <Upload className="h-3 w-3" />
                Upload
              </button>
            </div>

            {slot.mode === "upload" ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-slate-300 p-3 text-left dark:border-zinc-700"
              >
                <ImagePlus className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">PNG, JPG, or WebP — max 8MB</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  placeholder="Describe the frame..."
                  disabled={isGenerating}
                  className="min-w-0 flex-1 rounded-lg bg-slate-100 px-2.5 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  disabled={isGenerating || !aiPrompt.trim()}
                  onClick={() => {
                    onGenerate(aiPrompt);
                    setOpen(false);
                  }}
                  className="flex shrink-0 items-center justify-center rounded-lg bg-blue-500 px-2.5 py-2 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_FRAME_IMAGE_BYTES) return;
                onChange({ ...slot, dataUrl: await readFileAsDataUrl(file) });
                setOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FrameImagePickerProps {
  startFrame: FrameSlotState;
  onStartFrameChange: (next: FrameSlotState) => void;
  onGenerateStartFrame: (prompt: string) => void;
  isGeneratingStartFrame: boolean;

  endFrame: FrameSlotState;
  onEndFrameChange: (next: FrameSlotState) => void;
  onGenerateEndFrame: (prompt: string) => void;
  isGeneratingEndFrame: boolean;
  supportsEndFrame: boolean;
}

/**
 * Docked "Start frame" / "End frame" tiles -- mirrors the competitor's
 * layout of pinning first/last-frame conditioning next to the prompt box
 * instead of a row pill, since it's the primary input for image-to-video
 * rather than a secondary option. Each slot can be uploaded directly or
 * generated on the spot by chaining the existing Image Generator (POST
 * /api/generate-image, wired by the parent).
 */
export function FrameImagePicker({
  startFrame,
  onStartFrameChange,
  onGenerateStartFrame,
  isGeneratingStartFrame,
  endFrame,
  onEndFrameChange,
  onGenerateEndFrame,
  isGeneratingEndFrame,
  supportsEndFrame,
}: FrameImagePickerProps) {
  return (
    <div className="flex shrink-0 gap-2">
      <FrameBox
        label="Start frame"
        slot={startFrame}
        onChange={onStartFrameChange}
        isGenerating={isGeneratingStartFrame}
        onGenerate={onGenerateStartFrame}
      />
      {supportsEndFrame && (
        <FrameBox
          label="End frame"
          slot={endFrame}
          onChange={onEndFrameChange}
          isGenerating={isGeneratingEndFrame}
          onGenerate={onGenerateEndFrame}
        />
      )}
    </div>
  );
}
