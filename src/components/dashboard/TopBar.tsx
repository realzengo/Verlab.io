"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Menu, Rocket } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { ProfileDropdown } from "@/components/dashboard/ProfileDropdown";
import { UpgradeModal } from "@/components/pricing/UpgradeModal";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Kept as the original glass-pill recipe (see plastic-button.tsx's git
// history) rather than the shared PlasticButton's chunkier CTA look --
// this one lives in the compact top bar, not as a page-level CTA.
const UPGRADE_BUTTON_STYLES = `
@keyframes upgrade-btn-sheen {
  from { transform: translateX(-140%) skewX(-16deg); }
  to   { transform: translateX(320%)  skewX(-16deg); }
}
.upgrade-btn-sheen { transform: translateX(-140%) skewX(-16deg); }
.upgrade-btn:hover .upgrade-btn-sheen {
  animation: upgrade-btn-sheen 0.85s cubic-bezier(0.32, 0, 0.24, 1);
}
.upgrade-btn::after {
  content: "";
  position: absolute;
  inset: 1px;
  z-index: 1;
  border-radius: inherit;
  opacity: 0;
  mix-blend-mode: overlay;
  background: radial-gradient(101.79% 101.79% at 65.61% 81.79%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%);
  transition: opacity 0.3s ease-in-out;
}
.upgrade-btn:hover::after { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .upgrade-btn:hover .upgrade-btn-sheen { animation: none; }
}
`;

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

// "Welcome back" only for the session right after an explicit sign-in
// (Supabase's SIGNED_IN event) -- a plain page reload with a persisted
// session fires INITIAL_SESSION instead, so that stays a plain "Hey".
const FRESH_LOGIN_KEY = "verlab-fresh-login";

function greeting(justSignedIn: boolean): string {
  return justSignedIn ? "Welcome back" : "Hey";
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
  const [justSignedIn, setJustSignedIn] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(FRESH_LOGIN_KEY) === "1"
  );
  useEffect(() => {
    if (!isHome) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN") {
        sessionStorage.setItem(FRESH_LOGIN_KEY, "1");
        setJustSignedIn(true);
      } else if (event === "SIGNED_OUT") {
        sessionStorage.removeItem(FRESH_LOGIN_KEY);
        setJustSignedIn(false);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [isHome]);

  const hideHeading =
    !isPaywalled &&
    (isHome ||
      pathname.startsWith("/scripts") ||
      pathname.startsWith("/library") ||
      pathname.startsWith("/transcripts") ||
      pathname.startsWith("/mcp") ||
      pathname.startsWith("/image-generator") ||
      pathname.startsWith("/video-generator") ||
      pathname.startsWith("/voiceover-generator") ||
      pathname.startsWith("/downloads") ||
      pathname.startsWith("/tools") ||
      pathname.startsWith("/settings"));

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
        {isHome && !isPaywalled ? (
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-heading sm:text-xl" suppressHydrationWarning>
              {greeting(justSignedIn)}
              {firstName(user) && <>, {firstName(user)}</>}
            </h1>
            <p className="truncate text-xs text-subtle sm:text-sm">What will you create?</p>
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
          <button
            type="button"
            onClick={() => setIsUpgradeOpen(true)}
            className="upgrade-btn relative isolate flex h-9 items-center justify-center gap-1.5 overflow-hidden rounded-full px-3.5 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.98]"
            style={{
              backgroundImage:
                "radial-gradient(101.79% 101.79% at 65.61% 81.79%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%), radial-gradient(114.65% 114.65% at 9.73% 17.27%, #1e82e0 0%, #1c38ea 100%)",
              backgroundBlendMode: "overlay, normal",
              boxShadow: "inset -3px -3px 4px rgba(191,229,251,0.4), inset 4px 4px 4px rgba(19,26,228,0.1)",
            }}
          >
            <style>{UPGRADE_BUTTON_STYLES}</style>

            <span aria-hidden className="pointer-events-none absolute inset-0 z-20 blur-[1px]">
              <span
                className="absolute -left-px -top-px z-20 h-full w-full"
                style={{
                  opacity: 0.45,
                  padding: 2,
                  borderRadius: 9999,
                  background: "linear-gradient(176.87deg, rgba(255,255,255,0.5) 8.56%, rgba(255,255,255,0) 85.04%)",
                  WebkitMask: "linear-gradient(#fff, #fff) content-box, linear-gradient(#fff, #fff)",
                  WebkitMaskComposite: "xor",
                  mask: "linear-gradient(#fff, #fff) content-box, linear-gradient(#fff, #fff)",
                  maskComposite: "exclude",
                }}
              />
            </span>

            <span
              aria-hidden
              className="upgrade-btn-sheen pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 blur-[5px]"
              style={{
                background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
              }}
            />

            <span className="relative z-30 flex items-center gap-1.5">
              <Rocket className="h-3.5 w-3.5" fill="currentColor" />
              <span className="hidden sm:inline-block">Upgrade</span>
            </span>
          </button>
        )}
        <ProfileDropdown isPaywalled={isPaywalled} />
      </div>

      {!isPaywalled && <UpgradeModal isOpen={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} />}
    </div>
  );
}
