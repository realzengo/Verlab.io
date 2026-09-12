"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ADMIN_NAV } from "@/lib/mock-data";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function heading(pathname: string): string {
  if (pathname === "/admin") return "Overview";
  const match = ADMIN_NAV.find((item) => item.href !== "/admin" && pathname.startsWith(item.href));
  return match?.label ?? "Admin";
}

export function AdminTopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-6 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="shrink-0 rounded-md p-1.5 text-body transition-colors hover:bg-black/[0.05] hover:text-heading md:hidden dark:hover:bg-white/[0.06]"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* heading-2: the weight-700 headline against calm 400 body copy is the
            system's primary expressive lever. Tracking is set in globals.css. */}
        <h1 className="truncate">{heading(pathname)}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {/* badge-pill: white surface, eyebrow type, fully pill. */}
        <span className="hidden items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold tracking-[0.125px] text-subtle sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          All systems operational
        </span>
        <ThemeToggle />
      </div>
    </div>
  );
}
