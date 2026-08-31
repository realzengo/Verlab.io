"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Menu, Rocket } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { CreditDropdown } from "@/components/dashboard/CreditDropdown";
import { ProfileDropdown } from "@/components/dashboard/ProfileDropdown";
import { UpgradeModal } from "@/components/pricing/UpgradeModal";
import { PlasticButton } from "@/components/ui/plastic-button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function defaultHeading(pathname: string): string {
  const match = SIDEBAR_NAV.find((item) => pathname.startsWith(item.href) && item.href !== "/");
  if (match) return match.label;
  if (pathname.startsWith("/settings")) return "Settings";
  return "Verlab";
}

function firstName(user: User | null): string {
  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const full = meta?.full_name ?? meta?.name ?? user?.email?.split("@")[0] ?? "";
  const first = full.split(" ")[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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
  const isHome = pathname === "/";
  const resolvedHeading = heading ?? defaultHeading(pathname);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const today = isHome
    ? new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";

  useEffect(() => {
    if (!isHome) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, [isHome]);

  const hideHeading =
    isHome ||
    pathname.startsWith("/scripts") ||
    pathname.startsWith("/library") ||
    pathname.startsWith("/transcripts") ||
    pathname.startsWith("/mcp") ||
    pathname.startsWith("/image-generator") ||
    pathname.startsWith("/video-generator") ||
    pathname.startsWith("/voiceover-generator") ||
    pathname.startsWith("/downloads") ||
    pathname.startsWith("/tools") ||
    pathname.startsWith("/settings");

  return (
    <div
      className={cn(
        "relative z-30 flex items-center justify-between gap-2 px-3 pb-2.5 pt-3 sm:gap-4 sm:px-6 md:px-8 sm:pb-4 sm:pt-5",
        // Niche Finder's tabs/search bar sit on the app background -- match
        // it here so the two don't show a seam before the page is scrolled.
        // Scoped to this one route rather than applied globally, since other
        // pages (home, MCP) rely on TopBar staying transparent over their
        // own background effects.
        pathname.startsWith("/niches") && "bg-surface dark:bg-[#000000]",
        isHome && "bg-white dark:bg-[#010204]"
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
        {isHome ? (
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-heading sm:text-xl" suppressHydrationWarning>
              {timeGreeting()}
              {firstName(user) && <>, {firstName(user)}</>}
            </h1>
            {today && (
              <p className="hidden truncate text-xs text-subtle sm:block" suppressHydrationWarning>
                {today}
              </p>
            )}
          </div>
        ) : (
          !hideHeading && (
            <h1 className="min-w-0 truncate text-lg font-bold tracking-tight text-heading sm:text-2xl">
              {resolvedHeading}
            </h1>
          )
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {!isPaywalled && (
          <>
            <PlasticButton
              onClick={() => setIsUpgradeOpen(true)}
              className="h-9 px-3.5 font-semibold"
              text={
                <>
                  <Rocket className="h-3.5 w-3.5" fill="currentColor" />
                  <span className="hidden sm:inline-block">Upgrade</span>
                </>
              }
            />
            <CreditDropdown onUpgradeClick={() => setIsUpgradeOpen(true)} />
          </>
        )}
        <ProfileDropdown />
      </div>

      {!isPaywalled && <UpgradeModal isOpen={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} />}
    </div>
  );
}
