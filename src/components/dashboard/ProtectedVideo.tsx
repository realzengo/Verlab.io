"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

export function ProtectedVideo({
  src,
  srcDark,
  poster,
  posterDark,
  className,
  style,
}: {
  src: string;
  /** Dark-mode variant. When set, only one of `src`/`srcDark` is ever mounted (based on the resolved theme) instead of rendering both and hiding one with CSS. */
  srcDark?: string;
  poster?: string;
  posterDark?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { resolvedTheme } = useTheme();
  const activeSrc = resolvedTheme === "dark" && srcDark ? srcDark : src;
  const activePoster = resolvedTheme === "dark" && posterDark ? posterDark : poster;

  const ref = useRef<HTMLVideoElement>(null);
  // Cards below the fold shouldn't decode/play video until scrolled into
  // view -- with a full grid of these on the dashboard, autoplaying every
  // one at once on mount was enough concurrent video decode to jank the
  // whole page, including click responsiveness.
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={inView ? activeSrc : undefined}
      poster={activePoster}
      className={className}
      style={style}
      autoPlay={inView}
      loop
      muted
      playsInline
      preload={inView ? "metadata" : "none"}
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
