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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="admin-card group flex min-w-0 flex-col gap-3 rounded-card border border-hairline p-4 shadow-card transition-[box-shadow,border-color] duration-200 hover:border-[color-mix(in_srgb,var(--color-hairline),var(--color-heading)_10%)] hover:shadow-card-hover"
        >
          <div className="flex items-center gap-2.5">
            <span className="admin-tile flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-subtle transition-colors group-hover:text-primary">
              <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <p className="truncate text-[13px] font-semibold text-heading">{item.label}</p>
            <ArrowUpRight
              className="ml-auto h-3.5 w-3.5 shrink-0 -translate-x-1 text-subtle opacity-0 transition-[opacity,translate] duration-200 group-hover:translate-x-0 group-hover:opacity-100"
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
