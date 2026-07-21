"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ChevronDown, CreditCard, LogOut, Menu, Settings } from "lucide-react";
import { SIDEBAR_NAV } from "@/lib/mock-data";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

function displayName(user: User | null): string {
  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? user?.email?.split("@")[0] ?? "";
}

function avatarUrl(user: User | null): string | null {
  const meta = user?.user_metadata as { avatar_url?: string; picture?: string } | undefined;
  return meta?.avatar_url ?? meta?.picture ?? null;
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const resolvedHeading = heading ?? defaultHeading(pathname);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const hideHeading =
    pathname === "/app" ||
    pathname.startsWith("/app/scripts") ||
    pathname.startsWith("/app/library") ||
    pathname.startsWith("/app/transcripts") ||
    pathname.startsWith("/app/mcp");

  return (
    <div className="relative z-30 flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-6 md:px-8">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="shrink-0 rounded-lg p-1 text-body hover:bg-accent md:hidden"
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

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-hairline bg-surface p-1 pl-1 pr-1 sm:pr-3"
            aria-label="Account menu"
          >
            <Avatar name={displayName(user)} src={avatarUrl(user)} size="sm" className="h-6 w-6 sm:h-7 sm:w-7" />
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-heading sm:inline-block">
              {displayName(user)}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-body" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-52 rounded-card-sm border border-hairline bg-surface p-1.5 shadow-card-hover">
              <div className="px-2.5 py-2">
                <p className="text-sm font-semibold text-heading">{displayName(user)}</p>
                <p className="text-xs text-body">{user?.email}</p>
              </div>
              <div className="my-1 border-t border-hairline" />
              <Link
                href="/app/settings"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-heading hover:bg-accent"
              >
                <Settings className="h-4 w-4 text-body" />
                Settings
              </Link>
              <Link
                href="/app/settings"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-heading hover:bg-accent"
              >
                <CreditCard className="h-4 w-4 text-body" />
                Billing
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-heading hover:bg-accent"
              >
                <LogOut className="h-4 w-4 text-body" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
