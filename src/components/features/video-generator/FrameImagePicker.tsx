"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface FrameSlotState {
  dataUrl: string | null;
  mode: "upload" | "ai";
}

export const EMPTY_FRAME_SLOT: FrameSlotState = { dataUrl: null, mode: "upload" };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

const MAX_FRAME_IMAGE_BYTES = 8 * 1024 * 1024;

function FrameSlot({
  label,
  slot,
  onChange,
  isGenerating,
  onGenerate,
  disabled,
  disabledReason,
}: {
  label: string;
  slot: FrameSlotState;
  onChange: (next: FrameSlotState) => void;
  isGenerating: boolean;
  onGenerate: (prompt: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [aiPrompt, setAiPrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (disabled) {
    return (
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <div className="flex items-center justify-center rounded-xl bg-slate-50 py-3 text-xs font-medium text-slate-400 dark:bg-white/[0.03] dark:text-slate-500">
          {disabledReason}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>

      {slot.dataUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
          <img src={slot.dataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-slate-900/[0.06] dark:ring-white/10" />
          <button
            type="button"
            onClick={() => onChange({ ...slot, dataUrl: null })}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            <X className="h-3 w-3" />
            Remove
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/[0.04]">
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
                onClick={() => onGenerate(aiPrompt)}
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
            }}
          />
        </>
      )}
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
 * "Images" popover -- first/last frame conditioning for image-to-video,
 * mirrors the competitor's FIRST FRAME / LAST FRAME layout: each slot can
 * be uploaded directly or generated on the spot by chaining the existing
 * Image Generator (POST /api/generate-image, wired by the parent). The
 * resulting data URLs are passed straight to fal's image_url/tail_image_url
 * params (no Storage upload needed, same as reference images already work
 * in ImageGenerator.tsx).
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasAnyFrame = Boolean(startFrame.dataUrl || endFrame.dataUrl);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium shadow-sm outline-none transition-colors duration-150 active:scale-[0.97]",
          "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          "dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-slate-200 dark:shadow-none dark:hover:border-white/[0.12] dark:hover:bg-white/[0.1]",
          open && "border-blue-400 bg-blue-50/60 dark:border-blue-400/50 dark:bg-blue-500/10"
        )}
      >
        <ImagePlus className="h-3.5 w-3.5" />
        {hasAnyFrame ? "Start & End Frame" : "Images"}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "absolute left-0 top-full z-50 mt-2 flex w-72 origin-top-left flex-col gap-4 rounded-2xl border p-4",
                "border-slate-200/70 bg-white/95 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl",
                "dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.03)]"
              )}
            >
              <FrameSlot
                label="First frame"
                slot={startFrame}
                onChange={onStartFrameChange}
                isGenerating={isGeneratingStartFrame}
                onGenerate={onGenerateStartFrame}
              />
              <FrameSlot
                label="Last frame"
                slot={endFrame}
                onChange={onEndFrameChange}
                isGenerating={isGeneratingEndFrame}
                onGenerate={onGenerateEndFrame}
                disabled={!supportsEndFrame || !startFrame.dataUrl}
                disabledReason={!supportsEndFrame ? "Not supported by this model" : "Needs first frame"}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
