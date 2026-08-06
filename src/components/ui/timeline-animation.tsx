"use client";

import { motion, useInView, type Variants } from "framer-motion";
import type { ReactNode, RefObject } from "react";

// Static per-tag motion components declared once at module scope -- motion()
// must never be called during render (it mints a new component type each
// time, resetting its animation state), so `as` is restricted to this map's
// keys rather than accepting an arbitrary ElementType.
const MOTION_TAGS = {
  div: motion.div,
  span: motion.span,
  p: motion.p,
  h2: motion.h2,
  h3: motion.h3,
} as const;

type MotionTag = keyof typeof MOTION_TAGS;

// Scroll-triggered reveal wrapper: renders `as` (defaulting to a div) and
// animates it from `customVariants.hidden` to `customVariants.visible` once
// `timelineRef`'s section enters the viewport. `animationNum` is passed
// through as the variants' `custom` value so a single `revealVariants`
// object can stagger a whole list via `i * delay`.
export function TimelineContent({
  as = "div",
  children,
  animationNum,
  timelineRef,
  customVariants,
  className,
}: {
  as?: MotionTag;
  children: ReactNode;
  animationNum: number;
  timelineRef: RefObject<HTMLElement | null>;
  customVariants: Variants;
  className?: string;
}) {
  const isInView = useInView(timelineRef, { once: true, amount: 0.2 });
  const MotionTagComponent = MOTION_TAGS[as];

  return (
    <MotionTagComponent
      custom={animationNum}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={customVariants}
      className={className}
    >
      {children}
    </MotionTagComponent>
  );
}
