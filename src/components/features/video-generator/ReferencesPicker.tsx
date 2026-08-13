"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock, ImageIcon, Plus, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GLASS_PANEL, GLASS_PILL_ACTIVE, GLASS_PILL_BASE, GLASS_PILL_FOCUS, GLASS_PILL_IDLE } from "@/components/ui/PillDropdown";
import { loadFrameFile } from "./FrameImagePicker";
import { FrameImageGenerateModal } from "./FrameImageGenerateModal";

const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;

interface RecentImage {
  id: string;
  prompt: string;
}

/**
 * Fetches the user's recent completed image generations for the
 * "Recently used" menu item -- list rows don't carry the full `images`
 * array (see LIST_SELECT in generate-image/route.ts), so picking one does a
 * follow-up ?id= fetch for the full-resolution data URL, same pattern
 * FrameImageGenerateModal's own history sidebar uses.
 */
async function fetchRecentImages(): Promise<RecentImage[]> {
  const response = await fetch("/api/generate-image");
  if (!response.ok) return [];
  const data = await response.json().catch(() => null);
  const rows: { id: string; prompt: string; status: string; outputs: number }[] = data?.generations ?? [];
  return rows.filter((row) => row.status === "completed" && row.outputs > 0).slice(0, 12);
}

async function fetchImageDataUrl(id: string): Promise<string | null> {
  const response = await fetch(`/api/generate-image?id=${id}`);
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  const match = (data?.generations ?? []).find((row: { id: string }) => row.id === id);
  return match?.images?.[0] ?? null;
}

function RecentlyUsedPanel({ onSelect, onBack }: { onSelect: (dataUrl: string) => void; onBack: () => void }) {
  const [images, setImages] = useState<RecentImage[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentImages().then(setImages);
  }, []);

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
      >
        ← Back
      </button>
      {images === null ? (
        <div className="flex h-20 items-center justify-center text-xs text-slate-400">Loading…</div>
      ) : images.length === 0 ? (
        <div className="flex h-20 flex-col items-center justify-center gap-1 text-slate-300 dark:text-slate-600">
          <ImageIcon className="h-5 w-5" />
          <span className="text-[11px] font-medium">No recent images</span>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              disabled={loadingId !== null}
              onClick={async () => {
                setLoadingId(image.id);
                const dataUrl = await fetchImageDataUrl(image.id);
                setLoadingId(null);
                if (dataUrl) onSelect(dataUrl);
              }}
              aria-label={image.prompt}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200 transition-opacity hover:opacity-80 disabled:opacity-50 dark:ring-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- lazily-resized thumbnail served by /api/library/image */}
              <img src={`/api/library/image/${image.id}/0?w=80`} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ReferencesPickerProps {
  images: string[];
  onChange: (next: string[]) => void;
  max: number;
  className?: string;
}

/**
 * Create tab's "+ References" control -- style/subject reference images
 * attached to guide the whole generation, distinct from FrameImagePicker's
 * docked Start/End frame tiles (which pin down specific frames). Mirrors
 * the competitor's menu shape: a dropdown offering AI Generate, a picker
 * over recently generated images, or a direct upload, rather than
 * ReferenceImagesPicker's simpler upload-only grid (kept as-is for the Edit
 * tab). Attached images render as "@ImageN" chips + thumbnails in the
 * prompt card -- see VideoGenerator.tsx.
 */
export function ReferencesPicker({ images, onChange, max, className }: ReferencesPickerProps) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"menu" | "recent">("menu");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  function closeAndReset() {
    setOpen(false);
    setPanel("menu");
  }

  function addImage(dataUrl: string) {
    if (images.length >= max) {
      setError(`You can attach up to ${max} reference images.`);
      return;
    }
    setError(null);
    onChange([...images, dataUrl]);
  }

  const atMax = images.length >= max;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn("group", GLASS_PILL_BASE, GLASS_PILL_IDLE, GLASS_PILL_FOCUS, (open || images.length > 0) && GLASS_PILL_ACTIVE)}
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
        References
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn("absolute left-0 top-full z-50 mt-2 w-64 origin-top-left rounded-2xl p-1.5", GLASS_PANEL)}
          >
            {atMax ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">You&apos;ve attached the max of {max} references.</p>
            ) : panel === "recent" ? (
              <div className="p-1.5">
                <RecentlyUsedPanel
                  onBack={() => setPanel("menu")}
                  onSelect={(dataUrl) => {
                    addImage(dataUrl);
                    closeAndReset();
                  }}
                />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowGenerateModal(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-slate-400" />
                  AI Generate Image
                </button>
                <button
                  type="button"
                  onClick={() => setPanel("recent")}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                >
                  <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                  Recently used
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                >
                  <Upload className="h-4 w-4 shrink-0 text-slate-400" />
                  Upload image
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
            setError("Reference image is too large (max 8MB).");
            return;
          }
          await loadFrameFile(
            file,
            (slot) => {
              if (slot.dataUrl) addImage(slot.dataUrl);
            },
            setError
          );
        }}
      />

      {error && (
        <p role="alert" className="absolute left-0 top-full z-10 mt-1 w-48 text-[10px] font-medium leading-tight text-red-500">
          {error}
        </p>
      )}

      {showGenerateModal && (
        <FrameImageGenerateModal
          frameLabel="reference image"
          defaultAspectRatio="1:1"
          onClose={() => setShowGenerateModal(false)}
          onSelect={(dataUrl) => {
            addImage(dataUrl);
            setShowGenerateModal(false);
          }}
        />
      )}
    </div>
  );
}

/** "@ImageN" chip + thumbnail row, rendered above the prompt textarea when references are attached. */
export function ReferenceImageChips({ images, onChange }: { images: string[]; onChange: (next: string[]) => void }) {
  if (images.length === 0) return null;

  function remove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {images.map((image, index) => (
          <span
            key={index}
            className="group/chip flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2.5 text-[11px] font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
          >
            <span className="h-4 w-4 shrink-0 overflow-hidden rounded-full ring-1 ring-slate-900/[0.06] dark:ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
              <img src={image} alt="" className="h-full w-full object-cover" />
            </span>
            @Image{index + 1}
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove reference image ${index + 1}`}
              className="text-slate-400 opacity-0 transition-opacity duration-150 hover:text-slate-600 group-hover/chip:opacity-100 dark:hover:text-slate-200"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {images.map((image, index) => (
          <div key={index} className="group/ref relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200 dark:ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
            <img src={image} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove reference image ${index + 1}`}
              className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 group-hover/ref:bg-black/40 group-hover/ref:opacity-100"
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
