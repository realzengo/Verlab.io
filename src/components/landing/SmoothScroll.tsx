"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/** Replaces native scroll with a slower, weighted inertial glide so the
 * landing page reads as premium rather than snappy. Scoped to this page only
 * (mounted from the marketing page, torn down on unmount) so app routes with
 * virtualized lists and internal-scroll modals are unaffected. No-ops for
 * users who've asked for reduced motion. */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.35,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
      wheelMultiplier: 0.85,
      touchMultiplier: 1,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    document.documentElement.classList.add("lenis-active");

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      document.documentElement.classList.remove("lenis-active");
    };
  }, []);

  return null;
}
