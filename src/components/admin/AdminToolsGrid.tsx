import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeTone = "default" | "success" | "warning" | "danger";

const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  default: "bg-accent text-primary",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
};

export interface AdminToolCardData {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  badge?: string;
  badgeTone?: BadgeTone;
}

export function AdminToolsGrid({ items }: { items: AdminToolCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group flex flex-col gap-4 rounded-card border border-hairline bg-surface p-5 shadow-card transition-[transform,box-shadow] hover:-translate-y-[3px] hover:shadow-card-hover"
        >
          <div className="flex items-start justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
              <item.icon className="h-[18px] w-[18px]" />
            </span>
            <ArrowUpRight className="h-4 w-4 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div>
            <p className="text-sm font-semibold text-heading">{item.label}</p>
            <p className="mt-0.5 text-xs text-body">{item.description}</p>
          </div>
          {item.badge && (
            <span
              className={cn(
                "mt-auto inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                BADGE_TONE_CLASSES[item.badgeTone ?? "default"]
              )}
            >
              {item.badge}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
