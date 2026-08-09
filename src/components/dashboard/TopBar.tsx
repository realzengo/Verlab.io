"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Rocket } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { CreditDropdown } from "@/components/dashboard/CreditDropdown";
import { ProfileDropdown } from "@/components/dashboard/ProfileDropdown";
import { UpgradeModal } from "@/components/pricing/UpgradeModal";
import { cn } from "@/lib/utils";

function defaultHeading(pathname: string): string {
  const match = SIDEBAR_NAV.find((item) => pathname.startsWith(item.href) && item.href !== "/app");
  if (match) return match.label;
  if (pathname.startsWith("/app/settings")) return "Settings";
  return "Verlab";
}

export function TopBar({
  heading,
  onMenuClick,
  isPaywalled = false,
}: {
  heading?: string;
  onMenuClick: () => void;
  /** Hides the Upgrade button and credit balance -- both point at a plan/credits the user doesn't have yet while the main content area is already the pricing view (see AppShell). */
  isPaywalled?: boolean;
}) {
  const pathname = usePathname();
  const resolvedHeading = heading ?? defaultHeading(pathname);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);

  const hideHeading =
    pathname === "/app" ||
    pathname.startsWith("/app/scripts") ||
    pathname.startsWith("/app/library") ||
    pathname.startsWith("/app/transcripts") ||
    pathname.startsWith("/app/mcp") ||
    pathname.startsWith("/app/image-generator") ||
    pathname.startsWith("/app/video-generator") ||
    pathname.startsWith("/app/voiceover-generator") ||
    pathname.startsWith("/app/downloads") ||
    pathname.startsWith("/app/tools") ||
    pathname.startsWith("/app/settings");

  return (
    <div
      className={cn(
        "relative z-30 flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-6 md:px-8",
        // Niche Finder's sticky search bar is solid white -- match it here
        // so the two don't show a seam before the page is scrolled. Scoped
        // to this one route rather than applied globally, since other pages
        // (home, MCP) rely on TopBar staying transparent over their own
        // background effects.
        pathname.startsWith("/app/niches") && "bg-surface"
      )}
    >
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
        {!isPaywalled && (
          <>
            <button
              type="button"
              onClick={() => setIsUpgradeOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-btn-primary py-1.5 pl-3 pr-3.5 text-sm font-semibold text-white transition-colors hover:bg-btn-primary-hover"
            >
              <Rocket className="h-3.5 w-3.5" fill="currentColor" />
              <span className="hidden sm:inline-block">Upgrade</span>
            </button>
            <CreditDropdown onUpgradeClick={() => setIsUpgradeOpen(true)} />
          </>
        )}
        <ProfileDropdown />
      </div>

      {!isPaywalled && <UpgradeModal isOpen={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} />}
    </div>
  );
}
