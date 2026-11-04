"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Charts draw in real pixels -- a 2px line stays 2px and a dot stays round --
 * so they need the container's width rather than a stretched viewBox. Starts
 * at 0 on the server; the first measure lands before paint on the client.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
