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

// Guards against pathologically large source uploads before we even try to
// decode them -- everything under this gets normalized down to a small JPEG
// below, so this is not a "your photo is too big" limit users should hit.
export const MAX_FRAME_IMAGE_BYTES = 40 * 1024 * 1024;

const FRAME_IMAGE_MAX_DIMENSION = 2048;
const FRAME_IMAGE_JPEG_QUALITY = 0.88;

function bitmapToJpegDataUrl(bitmap: ImageBitmap): string {
  const scale = Math.min(1, FRAME_IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", FRAME_IMAGE_JPEG_QUALITY);
}

/** Resolves once `src` actually paints, rejects if the browser can't render it (e.g. HEIC in Chrome/Firefox). */
function canRenderAsImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/**
 * Normalizes an uploaded start/end frame image so it reliably renders and
 * uploads: decodes via `createImageBitmap` (handles camera/phone photos --
 * large dimensions, EXIF-rotated, sometimes formats a raw `<img src>` chokes
 * on -- more robustly than FileReader alone) then re-encodes as a downscaled
 * JPEG data URL. Falls back to a plain FileReader data URL if decoding fails
 * outright, but only once that fallback is confirmed to actually paint in an
 * `<img>` -- otherwise a genuinely unsupported format (e.g. HEIC in browsers
 * without a decoder) would sit in the slot for a frame, then have the
 * thumbnail's own onError silently clear it right back out.
 */
export async function processFrameImageFile(file: File): Promise<string> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return bitmapToJpegDataUrl(bitmap);
    } catch {
      // Unsupported/undecodable by createImageBitmap -- try a raw read below.
    }
  }
  const dataUrl = await readFileAsDataUrl(file);
  if (!(await canRenderAsImage(dataUrl))) {
    throw new Error(`This browser can't display ${file.type || "that image format"}. Try converting it to JPG or PNG first.`);
  }
  return dataUrl;
}

/** Shared validate-then-normalize path for both the file picker and drag-and-drop. */
export async function loadFrameFile(file: File, onChange: (next: FrameSlotState) => void, setError: (message: string | null) => void) {
  if (!file.type.startsWith("image/")) {
    setError("That file isn't an image.");
    return;
  }
  if (file.size > MAX_FRAME_IMAGE_BYTES) {
    setError(`Image is too large. Max size is ${MAX_FRAME_IMAGE_BYTES / (1024 * 1024)}MB.`);
    return;
  }

  try {
    const dataUrl = await processFrameImageFile(file);
    setError(null);
    onChange({ dataUrl, mode: "upload" });
  } catch (err) {
    setError(err instanceof Error && err.message ? err.message : "Couldn't read that file. Try a different image.");
  }
}

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
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(event: React.DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
  }
  function handleDragEnter(event: React.DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragCounterRef.current += 1;
    setIsDragOver(true);
  }
  function handleDragLeave(event: React.DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }
  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) loadFrameFile(file, onChange, setError);
  }

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
    <div
      ref={containerRef}
      className="relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {slot.dataUrl ? (
        <div className="group/frame relative h-28 w-20 shrink-0 overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
          <img
            src={slot.dataUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => {
              onChange({ ...slot, dataUrl: null });
              setError("Couldn't preview that image. Try a JPG or PNG.");
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 group-hover/frame:bg-black/40 group-hover/frame:opacity-100">
            <button
              type="button"
              onClick={() => {
                onChange({ ...slot, dataUrl: null });
                setError(null);
              }}
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
            (open || isDragOver) && "border-blue-400 bg-blue-50/60 text-blue-500 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-400"
          )}
        >
          <ImagePlus className="h-5 w-5" />
          <span className="leading-tight">{isDragOver ? "Drop image" : label}</span>
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
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        Deliberately rendered outside the AnimatePresence popover above: the
        Upload button calls setOpen(false) in the same click that opens this
        input's native file dialog, which unmounts the popover (and, if the
        input lived inside it) well before a real person finishes picking a
        file in Finder -- the dialog would still open, but the resulting
        change event has nowhere to land since its element is already gone
        from the DOM. Keeping the input always-mounted avoids that race.
      */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) loadFrameFile(file, onChange, setError);
        }}
      />

      {error && (
        <p
          role="alert"
          className="absolute left-0 top-full z-10 mt-1 w-32 text-[10px] font-medium leading-tight text-red-500"
        >
          {error}
        </p>
      )}

      {showGenerateModal && (
        <FrameImageGenerateModal
          frameLabel={frameLabel}
          defaultAspectRatio={aspectRatio}
          onClose={() => setShowGenerateModal(false)}
          onSelect={(dataUrl) => {
            setError(null);
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
