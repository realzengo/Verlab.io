import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusTone = "default" | "success" | "warning" | "danger";

// Status is a word plus a dot; the dot only ever means state.
const DOT: Record<StatusTone, string> = {
  default: "bg-(--viz-neutral)",
  success: "bg-(--viz-good)",
  warning: "bg-(--viz-warning)",
  danger: "bg-(--viz-critical)",
};

export interface AdminToolCardData {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  badge?: string;
  badgeTone?: StatusTone;
}

export function AdminToolsGrid({ items }: { items: AdminToolCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-hairline bg-hairline shadow-card sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group flex min-w-0 flex-col gap-3 bg-surface p-4 transition-colors hover:bg-[color-mix(in_srgb,var(--color-surface),var(--color-heading)_2%)]"
        >
          <div className="flex items-center gap-2">
            <item.icon className="h-4 w-4 shrink-0 text-subtle transition-colors group-hover:text-primary" aria-hidden="true" />
            <p className="truncate text-[13px] font-semibold text-heading">{item.label}</p>
            <ArrowUpRight
              className="ml-auto h-3.5 w-3.5 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </div>
          <p className="line-clamp-2 text-[12px] leading-[1.45] text-subtle">{item.description}</p>
          {item.badge && (
            <p className="mt-auto flex items-center gap-1.5 text-[12px] font-medium text-body">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[item.badgeTone ?? "default"])} aria-hidden="true" />
              <span className="truncate">{item.badge}</span>
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
