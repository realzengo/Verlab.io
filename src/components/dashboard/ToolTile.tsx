import Link from "next/link";
import type { ToolTileData } from "@/lib/types";

export function ToolTile({ tool }: { tool: ToolTileData }) {
  return (
    <Link
      href={tool.href}
      className="flex flex-col items-center gap-2.5 rounded-card-sm border border-hairline bg-surface p-4 text-center transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-chip bg-accent">
        <tool.icon className="h-5 w-5 text-primary" />
      </div>
      <span className="text-xs font-medium leading-tight text-heading">{tool.label}</span>
    </Link>
  );
}
