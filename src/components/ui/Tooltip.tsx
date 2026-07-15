import type { ReactNode } from "react";

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-chip border border-hairline bg-surface px-2.5 py-1.5 text-xs text-heading opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100">
        {content}
      </span>
    </span>
  );
}
