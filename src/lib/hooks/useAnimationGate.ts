"use client";

import { useEffect, useRef, useState } from "react";

/** Tracks whether an element is on-screen, for pairing with the `.anim-gate`
 * CSS rule (globals.css) that freezes descendant animations via
 * `animation-play-state` while off-screen — keeps always-on decorative
 * animations from burning compositor cycles when scrolled away. */
export function useAnimationGate<T extends Element>(threshold = 0) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView } as const;
}
