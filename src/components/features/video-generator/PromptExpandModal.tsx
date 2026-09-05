"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { GLASS_PANEL } from "@/components/ui/PillDropdown";
import { cn } from "@/lib/utils";
import { MentionTextarea } from "./MentionTextarea";
import { ReferenceImageChips } from "./ReferencesPicker";

interface PromptExpandModalProps {
  value: string;
  onChange: (value: string) => void;
  images: string[];
  onImagesChange: (next: string[]) => void;
  placeholder?: string;
  onClose: () => void;
  /** Selected model's hard prompt-length cap, if it has one (see maxPromptLength in video-models.ts) -- shown as a live counter that turns red past the limit. */
  maxLength?: number;
}

/**
 * Full-screen "expand the prompt" editor -- mirrors the competitor's
 * maximize-icon-to-popup flow for a cramped single-line prompt box. Reuses
 * MentionTextarea rather than a plain textarea so @-mentioning attached
 * references still works at full size, not just in the docked card.
 * Portaled to <body> for the same reason FrameImageGenerateModal is: opened
 * from inside VideoGenerator's `relative isolate` glow wrapper, which would
 * otherwise trap a nested `fixed` element under the app shell's header.
 */
export function PromptExpandModal({ value, onChange, images, onImagesChange, placeholder, onClose, maxLength }: PromptExpandModalProps) {
  const overLimit = Boolean(maxLength) && value.length > maxLength!;
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
      animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
      exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 18, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.94, y: 10, filter: "blur(4px)" }}
        transition={{ type: "spring", stiffness: 340, damping: 30, mass: 0.85 }}
        style={{ transformOrigin: "top right" }}
        className={cn(
          "flex h-full max-h-[760px] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-3xl",
          GLASS_PANEL
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 px-8 py-5 dark:border-white/[0.08]">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Prompt</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-900/[0.06] dark:text-slate-500 dark:hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-10 py-8">
          <ReferenceImageChips images={images} onChange={onImagesChange} />
          <MentionTextarea
            value={value}
            onChange={onChange}
            images={images}
            placeholder={placeholder}
            className="h-full w-full resize-none bg-transparent text-base font-normal leading-relaxed text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500"
          />
          {maxLength !== undefined && (
            <p className={cn("mt-2 shrink-0 self-end text-xs font-medium", overLimit ? "text-red-500" : "text-slate-400 dark:text-slate-500")}>
              {value.length} / {maxLength}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
