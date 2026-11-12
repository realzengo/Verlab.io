"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Portal } from "@/components/ui/Portal";

export type PreviewMedia = { kind: "video" | "image"; src: string; label: string };

/** The uploaded clip or a reference at full size: video with sound and controls, or the whole image. */
export function MediaLightbox({ media, onClose }: { media: PreviewMedia; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={media.label}
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
        <div onClick={(event) => event.stopPropagation()} className="flex max-h-full max-w-full">
          {media.kind === "video" ? (
            <video
              src={media.src}
              controls
              autoPlay
              playsInline
              className="max-h-[calc(100dvh-5rem)] max-w-full rounded-2xl bg-black shadow-2xl"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset
            <img
              src={media.src}
              alt={media.label}
              className="max-h-[calc(100dvh-5rem)] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          )}
        </div>
      </div>
    </Portal>
  );
}

const ZOOM_SIZE = 220;
const ZOOM_GAP = 10;

/**
 * A reference thumbnail that shows the image larger while the pointer rests
 * on it. The zoom renders in a portal, so the drop card's overflow can't clip
 * it, and sits above the thumbnail (below when there's no room). Touch
 * devices skip it and tap through to the lightbox instead.
 */
export function HoverZoom({ src, children, className }: { src: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const show = () => {
    if (!ref.current || !window.matchMedia("(hover: hover)").matches) return;
    setAnchor(ref.current.getBoundingClientRect());
  };

  // A scroll moves the thumbnail out from under the zoom; drop it.
  useEffect(() => {
    if (!anchor) return;
    const hide = () => setAnchor(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [anchor]);

  let style: React.CSSProperties | undefined;
  if (anchor) {
    const above = anchor.top - ZOOM_SIZE - ZOOM_GAP >= 8;
    const left = Math.min(
      Math.max(8, anchor.left + anchor.width / 2 - ZOOM_SIZE / 2),
      window.innerWidth - ZOOM_SIZE - 8
    );
    style = {
      left,
      top: above ? anchor.top - ZOOM_SIZE - ZOOM_GAP : anchor.bottom + ZOOM_GAP,
      width: ZOOM_SIZE,
      height: ZOOM_SIZE,
    };
  }

  return (
    <div ref={ref} onMouseEnter={show} onMouseLeave={() => setAnchor(null)} className={className}>
      {children}
      {style && (
        <Portal>
          <motion.div
            aria-hidden
            style={style}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="pointer-events-none fixed z-[70] overflow-hidden rounded-2xl bg-slate-50 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.45)] ring-1 ring-black/10 dark:bg-[#131318] dark:ring-white/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
            <img src={src} alt="" className="h-full w-full object-contain" />
          </motion.div>
        </Portal>
      )}
    </div>
  );
}
