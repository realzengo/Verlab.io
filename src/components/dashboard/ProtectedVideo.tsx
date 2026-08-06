"use client";

import type { CSSProperties } from "react";

export function ProtectedVideo({
  src,
  poster,
  className,
  style,
}: {
  src: string;
  poster?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <video
      src={src}
      poster={poster}
      className={className}
      style={style}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
