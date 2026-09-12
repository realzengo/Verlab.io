import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeTone = "default" | "success" | "warning" | "danger";

// badge-pill: white surface with blue eyebrow text by default. Only genuinely
// semantic states (live MRR, a failed job) reach for a status tint.
const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  default: "border border-hairline bg-surface text-primary",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
};

// Sticker colors cycle by position so each tool tile reads distinctly, the way
// Notion scatters app-icon stickers across a feature grid. Decoration only.
const STICKERS = [
  "admin-sticker-blue",
  "admin-sticker-orange",
  "admin-sticker-green",
  "admin-sticker-purple",
  "admin-sticker-pink",
  "admin-sticker-teal",
  "admin-sticker-sky",
  "admin-sticker-brown",
];

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
      {items.map((item, i) => (
        // feature-card: white surface, 12px radius, hairline at rest, lifting
        // onto the barely-there layered shadow on hover.
        <Link
          key={item.href}
          href={item.href}
          className="group flex flex-col gap-4 rounded-card border border-hairline bg-surface p-6 transition-[transform,box-shadow] hover:-translate-y-[2px] hover:shadow-card-hover"
        >
          <div className="flex items-start justify-between">
            <span
              className={cn(
                "admin-sticker flex h-9 w-9 items-center justify-center rounded-lg",
                STICKERS[i % STICKERS.length]
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
            </span>
            <ArrowUpRight className="h-4 w-4 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-[-0.125px] text-heading">{item.label}</p>
            <p className="mt-1 text-sm leading-[1.43] text-subtle">{item.description}</p>
          </div>
          {item.badge && (
            <span
              className={cn(
                "mt-auto inline-flex w-fit items-center rounded-full px-2 py-1 text-xs font-semibold tracking-[0.125px]",
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
