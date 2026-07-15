import Link from "next/link";
import type { ToolTileData, ToolTone } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<ToolTone, string> = {
  blue: "bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300",
  violet: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
  amber: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
  green: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  rose: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
  sky: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300",
};

export function ToolTile({ tool }: { tool: ToolTileData }) {
  return (
    <Link
      href={tool.href}
      className="group flex flex-col items-center gap-2.5 rounded-card-sm border border-hairline bg-surface p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover"
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-chip transition-transform group-hover:scale-105",
          TONE_CLASSES[tool.tone ?? "blue"]
        )}
      >
        <tool.icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium leading-tight text-heading">{tool.label}</span>
    </Link>
  );
}
