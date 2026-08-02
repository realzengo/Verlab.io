"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock, Folder, Loader2, Upload, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface SourceVideoOption {
  id: string;
  thumbnail_path: string | null;
  durationSeconds: number | null;
}

interface SourceVideoPickerProps {
  source: { id: string; thumbnail_path: string | null; durationSeconds: number | null } | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  onUploadFile: (file: File) => void;
  isUploading: boolean;
  library: SourceVideoOption[];
  /** "lg" is a full-width square tile for the mobile Edit panel (MobileEditPanel); default "sm" is the compact desktop-card tile. */
  size?: "sm" | "lg";
}

/**
 * The Edit tab's attached-video slot -- filled state shows the chosen clip
 * with a duration badge and remove button; empty state is a clickable
 * dropdown (mirrors FrameImagePicker's FrameBox affordance) offering
 * "Upload video" or "Your generated videos" instead of the previous static,
 * non-interactive placeholder text.
 */
export function SourceVideoPicker({ source, onSelect, onClear, onUploadFile, isUploading, library, size = "sm" }: SourceVideoPickerProps) {
  const lg = size === "lg";
  const [open, setOpen] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  // Portal target isn't available during SSR; the modal only ever opens
  // from a client click anyway, but createPortal itself needs `document` to
  // exist before it's called at all.
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  useEffect(() => {
    if (!libraryModalOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLibraryModalOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [libraryModalOpen]);

  if (source) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-2xl bg-black ring-1 ring-slate-200 dark:ring-white/10",
          lg ? "aspect-square w-full" : "h-28 w-24"
        )}
      >
        <video
          src={`/api/library/video/${source.id}`}
          poster={source.thumbnail_path ? `/api/library/video/${source.id}?variant=thumbnail` : undefined}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove attached video"
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80",
            lg ? "right-2 top-2 h-7 w-7" : "right-1 top-1 h-5 w-5"
          )}
        >
          <X className={lg ? "h-3.5 w-3.5" : "h-3 w-3"} />
        </button>
        {source.durationSeconds != null && (
          <span
            className={cn(
              "pointer-events-none absolute flex items-center gap-0.5 rounded-full bg-black/60 font-semibold text-white backdrop-blur-sm",
              lg ? "bottom-2 left-2 px-2 py-1 text-xs" : "bottom-1 left-1 px-1.5 py-0.5 text-[10px]"
            )}
          >
            <Clock className={lg ? "h-3 w-3" : "h-2.5 w-2.5"} /> {source.durationSeconds}s
          </span>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", lg && "w-full")}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        disabled={isUploading}
        className={cn(
          "flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed text-center font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-70",
          lg ? "aspect-square w-full px-4 text-sm" : "h-28 w-24 px-3 text-[11px]",
          "border-slate-300 text-slate-400 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-500",
          "dark:border-zinc-700 dark:text-slate-500 dark:hover:border-blue-400/50 dark:hover:bg-blue-500/[0.06] dark:hover:text-blue-400",
          open && "border-blue-400 bg-blue-50/60 text-blue-500 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-400"
        )}
      >
        {isUploading ? <Loader2 className={lg ? "h-6 w-6 animate-spin" : "h-4 w-4 animate-spin"} /> : <Video className={lg ? "h-6 w-6" : "h-4 w-4"} />}
        <span className="leading-tight">{isUploading ? "Uploading..." : "Video to edit"}</span>
        {!isUploading && <span className={cn("font-normal text-slate-400 dark:text-slate-500", lg ? "text-xs" : "text-[10px]")}>3-10s clips</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute left-0 top-full z-50 mt-2 w-56 origin-top-left rounded-2xl border p-1.5",
              "border-slate-200/70 bg-white/95 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl",
              "dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.03)]"
            )}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              <Upload className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              Upload video
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setLibraryModalOpen(true);
              }}
              disabled={library.length === 0}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/80 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              <Folder className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              Your generated videos
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setOpen(false);
                onUploadFile(file);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {libraryModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                onClick={() => setLibraryModalOpen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/[0.08]">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Choose a video</h2>
                    <button
                      type="button"
                      onClick={() => setLibraryModalOpen(false)}
                      aria-label="Close"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-white/[0.06]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto p-5">
                    {library.length === 0 ? (
                      <p className="py-10 text-center text-sm text-slate-400">No generated videos yet.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                        {library.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              onSelect(item.id);
                              setLibraryModalOpen(false);
                            }}
                            className="group relative aspect-[9/16] overflow-hidden rounded-xl bg-black ring-1 ring-slate-200 transition-all hover:ring-2 hover:ring-blue-400 dark:ring-white/10"
                          >
                            <video
                              src={`/api/library/video/${item.id}`}
                              poster={item.thumbnail_path ? `/api/library/video/${item.id}?variant=thumbnail` : undefined}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-full w-full object-cover"
                            />
                            {item.durationSeconds != null && (
                              <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                                <Clock className="h-2.5 w-2.5" /> {item.durationSeconds}s
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
