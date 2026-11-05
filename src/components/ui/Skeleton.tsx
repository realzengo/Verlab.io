import { cn } from "@/lib/utils";

/** Neutral placeholder block. `--app-fill-strong` is translucent, so the
 * same tone reads right on the app background and on a card surface, in
 * both themes. Callers set the size and radius. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-(--app-fill-strong) motion-reduce:animate-none", className)} />;
}
