"use client";

import type { MouseEvent, ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  /** Wash that follows the cursor, blended over whatever background the card content has. */
  spotlightColor?: string;
  /** Border gradient colors, from -> to, that follow the cursor. */
  borderFrom?: string;
  borderTo?: string;
  spotlightSize?: number;
  /** Set false to drop the resting 1px border ring entirely (spotlight wash still applies). */
  border?: boolean;
}

/**
 * Card wrapper with a cursor-tracking spotlight: a gradient ring lights up the
 * border and a soft-light wash sweeps over the content, both fading out when
 * the pointer leaves. The border is a 1px reveal trick (gradient layer behind
 * a solid inset layer); the wash sits above the card's own content with
 * mix-blend so it works regardless of the card's own background.
 */
export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(51, 92, 255, 0.55)",
  borderFrom = "#7aa2ff",
  borderTo = "#335cff",
  spotlightSize = 300,
  border = true,
}: SpotlightCardProps) {
  const mouseX = useMotionValue(-spotlightSize);
  const mouseY = useMotionValue(-spotlightSize);

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - rect.left);
    mouseY.set(event.clientY - rect.top);
  }

  function handleMouseLeave() {
    mouseX.set(-spotlightSize);
    mouseY.set(-spotlightSize);
  }

  const borderGradient = useMotionTemplate`radial-gradient(${spotlightSize}px circle at ${mouseX}px ${mouseY}px, ${borderFrom}, ${borderTo}, var(--color-hairline) 100%)`;
  const spotlightGradient = useMotionTemplate`radial-gradient(${spotlightSize}px circle at ${mouseX}px ${mouseY}px, ${spotlightColor}, transparent 70%)`;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("group relative rounded-[inherit]", className)}
    >
      {border && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ background: borderGradient }}
          />
          <div aria-hidden className="absolute inset-px rounded-[inherit] bg-surface" />
        </>
      )}
      <div className={cn("relative h-full overflow-hidden rounded-[inherit]", !border && "bg-surface")}>
        {children}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: spotlightGradient }}
        />
      </div>
    </div>
  );
}
