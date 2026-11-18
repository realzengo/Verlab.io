"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Charts draw in real pixels -- a 2px line stays 2px and a dot stays round --
 * so they need the container's width rather than a stretched viewBox. Starts
 * at 0 on the server; the first measure lands before paint on the client.
 */
export function useElementWidth<T extends HTMLElement>() {
  const [ref, { width }] = useElementSize<T>();
  return [ref, width] as const;
}

/** Width and height, for charts that grow to fill their panel (`fill`). */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (width: number, height: number) =>
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    const rect = el.getBoundingClientRect();
    measure(rect.width, rect.height);
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width, entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}
