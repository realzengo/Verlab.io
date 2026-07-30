"use client";

import { useEffect } from "react";

/** Freezes every CSS animation on the page while the user is actively
 * scrolling (see the `html[data-scrolling="true"]` rule in globals.css),
 * resuming shortly after scrolling stops. Scrolling itself is the one
 * thing that must never compete with decorative animation work — this
 * guarantees it, on top of the per-section visibility gating. */
export function ScrollAnimationPauser() {
  useEffect(() => {
    const root = document.documentElement;
    let stopTimeout: ReturnType<typeof setTimeout>;
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          root.setAttribute("data-scrolling", "true");
          ticking = false;
        });
      }

      clearTimeout(stopTimeout);
      stopTimeout = setTimeout(() => root.removeAttribute("data-scrolling"), 150);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(stopTimeout);
      root.removeAttribute("data-scrolling");
    };
  }, []);

  return null;
}
