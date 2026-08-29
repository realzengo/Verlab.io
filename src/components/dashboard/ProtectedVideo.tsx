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
  skipRanges,
}: {
  src: string;
  /** Dark-mode variant. When set, only one of `src`/`srcDark` is ever mounted (based on the resolved theme) instead of rendering both and hiding one with CSS. */
  srcDark?: string;
  poster?: string;
  posterDark?: string;
  className?: string;
  style?: CSSProperties;
  /** [start, end] second ranges (source-clip time) to jump over -- e.g. a blown-out focus-pull intro or a blank hold baked into the export. Checked every `timeupdate`, so the jump lands within a frame or two of `start`. Applies to whichever of `src`/`srcDark` is active, since both variants share the same cut and timing. */
  skipRanges?: [number, number][];
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

  useEffect(() => {
    const el = ref.current;
    if (!el || !skipRanges?.length) return;

    const jumpIfInRange = () => {
      const range = skipRanges.find(([start, end]) => el.currentTime >= start && el.currentTime < end);
      if (range) el.currentTime = range[1];
    };
    // `loadeddata` catches the very first frame (before playback has produced a
    // `timeupdate`) so the initial paint doesn't flash the skipped range too.
    el.addEventListener("loadeddata", jumpIfInRange);
    el.addEventListener("timeupdate", jumpIfInRange);
    return () => {
      el.removeEventListener("loadeddata", jumpIfInRange);
      el.removeEventListener("timeupdate", jumpIfInRange);
    };
  }, [skipRanges]);

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
