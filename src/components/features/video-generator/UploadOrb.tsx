import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Glossy light-blue disc the competitor flow uses as its upload affordance (Clone + Edit video cards). */
export function UploadOrb({ icon: Icon, filled = true, className }: { icon: LucideIcon; filled?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_24%,#ffffff_0%,#e1e9ff_42%,#a9c0ff_100%)] text-slate-900 shadow-[0_8px_18px_-8px_rgba(51,92,255,0.55),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-2px_4px_rgba(51,92,255,0.18)] dark:bg-[radial-gradient(circle_at_32%_24%,#c9d6ff_0%,#7f9cff_45%,#3d5fe0_100%)] dark:text-white dark:shadow-[0_8px_18px_-8px_rgba(51,92,255,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]",
        className
      )}
    >
      {/* Solid glyphs (camera, person) read best filled; an outline one
          like ImagePlus turns into a blob, so it opts out. */}
      <Icon className={cn("h-[45%] w-[45%]", filled && "fill-current")} strokeWidth={filled ? 1.5 : 2} />
    </span>
  );
}
