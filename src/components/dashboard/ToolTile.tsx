import Link from "next/link";
import type { ToolTileData } from "@/lib/types";
import { TOOL_TONE_CLASSES } from "@/lib/tone";
import { cn } from "@/lib/utils";

export function ToolTile({ tool }: { tool: ToolTileData }) {
  return (
    <Link
      href={tool.href}
      className="group flex flex-col items-center gap-2.5 rounded-card-sm border border-hairline bg-surface p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10"
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-chip transition-transform group-hover:scale-105",
          TOOL_TONE_CLASSES[tool.tone ?? "blue"]
        )}
      >
        <tool.icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium leading-tight text-heading">{tool.label}</span>
    </Link>
  );
}
