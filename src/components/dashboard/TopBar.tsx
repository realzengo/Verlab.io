"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { ProfileDropdown } from "@/components/dashboard/ProfileDropdown";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function defaultHeading(pathname: string): string {
  const match = SIDEBAR_NAV.find((item) => pathname.startsWith(item.href) && item.href !== "/app");
  if (match) return match.label;
  if (pathname.startsWith("/app/settings")) return "Settings";
  return "Verlab";
}

export function TopBar({
  heading,
  onMenuClick,
}: {
  heading?: string;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const resolvedHeading = heading ?? defaultHeading(pathname);

  const hideHeading =
    pathname === "/app" ||
    pathname.startsWith("/app/scripts") ||
    pathname.startsWith("/app/library") ||
    pathname.startsWith("/app/transcripts") ||
    pathname.startsWith("/app/mcp") ||
    pathname.startsWith("/app/image-generator") ||
    pathname.startsWith("/app/downloads") ||
    pathname.startsWith("/app/settings");

  return (
    <div className="relative z-30 flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-6 md:px-8">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="shrink-0 rounded-lg p-1 text-body hover:bg-accent lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        {!hideHeading && (
          <h1 className="min-w-0 truncate text-lg font-bold tracking-tight text-heading sm:text-2xl">
            {resolvedHeading}
          </h1>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <ThemeToggle className="h-7 w-7 sm:h-9 sm:w-9" />
        <ProfileDropdown />
      </div>
    </div>
  );
}
