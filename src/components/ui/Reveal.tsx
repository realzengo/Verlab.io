"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Scroll-triggered fade/rise-in reveal for landing sections that otherwise
 * pop in fully rendered. Fires once, the moment the element crosses into
 * view (see the `.reveal` rule in globals.css), then stays settled — unlike
 * `.anim-gate`'s always-on toggle used for looping decorative animation. */
export function Reveal({
  children,
  className,
  delay = 0,
  instantOnMobile = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Skip the fade/rise-in on phone screens (<640px) -- content renders in
   * its resting state immediately there, and only animates from `sm:` up. */
  instantOnMobile?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-inview={inView}
      className={cn(instantOnMobile ? "sm:reveal" : "reveal", className)}
      style={delay ? ({ transitionDelay: `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
