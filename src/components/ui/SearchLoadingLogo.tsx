"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// A soft "ease-out-expo" curve -- the entrance snaps in with energy and
// settles gently, the same curve behind most of Linear/Vercel-style
// micro-interactions, instead of framer's default (flatter, less alive).
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_BREATHE = [0.45, 0, 0.55, 1] as const;

/** Centered logo mark with a single thin rotating gradient ring and a slow
 * breathing pulse -- used anywhere a fetch is in flight (niche search,
 * video list refresh) in place of a generic spinner.
 *
 * Deliberately minimal: an earlier pass added a second ring and a large
 * blurred ambient-glow halo, which looked layered and "designed" in
 * isolation but turned to visual mud once composited over this component's
 * real usage -- centered inside a page overlay that already applies its own
 * backdrop-blur-sm (see NicheFinder.tsx), the extra blur just doubled up
 * into a soft blob instead of a crisp mark. One ring, no separate glow. */
export function SearchLoadingLogo({
  size = 64,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  // Disc + solid punch-circle trick: a full conic disc with a
  // same-color-as-background circle laid over its center, so only the band
  // between the two edges reads as a ring.
  const ringPunchInset = Math.max(2, size * 0.08);

  return (
    <motion.div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
    >
      {/* A thin sweep with a soft leading/trailing fade instead of a
          hard-edged arc, so the trail reads as a clean comet, not a wedge. */}
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(51,92,255,0) 15deg, rgba(51,92,255,0.35) 55deg, rgba(34,70,214,1) 100deg, rgba(51,92,255,1) 150deg, rgba(51,92,255,0) 205deg, transparent 360deg)",
        }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
      />
      {/* Punches the disc down to a stroke. */}
      <span aria-hidden className="absolute rounded-full bg-app" style={{ inset: ringPunchInset }} />

      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={
          reduceMotion
            ? { opacity: 1 }
            : { scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }
        }
        transition={{ duration: 1.8, repeat: Infinity, ease: EASE_BREATHE }}
      >
        {/* Plain <img>, not next/image -- next/image's on-demand resize
            route can take a beat to compile on its first request, so the
            logo would often still be blank by the time a (usually brief)
            loading state ends. A static file under /public paints the
            instant the browser has it, same as the CSS ring beside it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-circle.png"
          alt=""
          width={Math.round(size * 0.66)}
          height={Math.round(size * 0.66)}
          className="drop-shadow-[0_0_10px_rgba(51,92,255,0.4)]"
        />
      </motion.div>
    </motion.div>
  );
}
