import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Neutral placeholder block. `--app-fill-strong` is translucent, so the
 * same tone reads right on the app background and on a card surface, in
 * both themes. Callers set the size and radius. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div style={style} className={cn("animate-pulse bg-(--app-fill-strong) motion-reduce:animate-none", className)} />;
}
